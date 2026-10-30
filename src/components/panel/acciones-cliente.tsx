"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { canjearPremio, deshacerCorte } from "@/app/panel/clientes/acciones";
import { Celebracion } from "@/components/carnet/celebracion";
import { GrillaSellos } from "@/components/carnet/sellos";
import { Button } from "@/components/ui/button";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import { textoCobrado, useSumarCorte } from "@/hooks/use-sumar-corte";
import {
  calcularProgreso,
  enFrase,
  type Etapa,
  etapaAlcanzada,
  type PremioEtapa,
  textoCortes,
} from "@/lib/progreso";
import { TarjetaMensualidad } from "@/components/carnet/tarjeta-mensualidad";
import type { EstadoMensualidad } from "@/lib/datos/mensualidad";
import { BotonCanjear, ListaPremios } from "./boton-canjear";
import { CampoMonto } from "./campo-monto";
import { BotonUsarMensualidad, DialogoCobrarMensualidad } from "./mensualidad";

type Props = {
  cliente: {
    id: string;
    nombre: string;
    total_cortes: number;
    premios_disponibles: number;
    cortes_necesarios: number | null;
    descripcion_premio: string | null;
    etapas: Etapa[] | null;
    premios: PremioEtapa[];
    precio_habitual: number | null;
  };
  /** Servicio del turno de ahora (si reservó con servicio): se cobra su precio. */
  servicioTurno?: { nombre: string; precio: number } | null;
  mensualidad: EstadoMensualidad;
};

/**
 * Avance de la tarjeta del cliente y acciones del barbero: sumar corte (con el
 * monto precargado con su precio habitual) y canjear premio (eligiendo cuál).
 */
export function AccionesCliente({ cliente, servicioTurno, mensualidad }: Props) {
  const p = calcularProgreso(cliente);
  const activa = mensualidad.activa;
  const primerNombre = cliente.nombre.split(" ")[0];
  const sumar = useSumarCorte(cliente.id, servicioTurno?.precio ?? cliente.precio_habitual);
  const canjear = useAccionUnica();
  const [festejo, setFestejo] = useState(0);

  // Detecta sellos nuevos entre renders para "estamparlos" (patrón de estado derivado).
  const [previos, setPrevios] = useState(p.mostrados);
  const [nuevos, setNuevos] = useState(0);
  if (previos !== p.mostrados) {
    setNuevos(Math.max(0, p.mostrados - previos));
    setPrevios(p.mostrados);
  }

  function alSumar() {
    sumar.sumar((datos) => {
      const total = datos.cliente?.total_cortes ?? cliente.total_cortes + 1;
      const ganado = etapaAlcanzada(p.etapas, total);
      if (ganado) setFestejo((n) => n + 1);
      const cobrado = textoCobrado(datos.monto, datos.medio);
      toast.success(
        ganado
          ? `¡${primerNombre} ganó ${enFrase(ganado.descripcion)}!`
          : `Corte sumado a ${primerNombre}`,
        {
          description: ganado ? `${cobrado}. Ya lo puede canjear.` : cobrado,
          duration: 8000,
          action: {
            label: "Deshacer",
            onClick: async () => {
              const d = await deshacerCorte(datos.corteId);
              if (d.ok) toast.success("Corte deshecho");
              else toast.error(d.error);
            },
          },
        },
      );
    });
  }

  function alCanjear(etapa: number) {
    canjear.ejecutar(async (solicitudId) => {
      const r = await canjearPremio(cliente.id, solicitudId, etapa);
      if (r.ok) toast.success("Premio canjeado", { description: r.datos.premio });
      else toast.error(r.error);
    });
  }

  if (p.necesarios === 0) {
    return (
      <p className="rounded-xl border border-hierro bg-ebano p-5 text-sm text-arena">
        No hay una regla de premios configurada. Configurala en la sección Premios.
      </p>
    );
  }

  return (
    <section aria-labelledby="titulo-tarjeta" className="grid grid-cols-1 gap-4">
      <Celebracion disparo={festejo} />
      <div className="textura-grano rounded-2xl border border-hierro bg-ebano p-5 shadow-suave sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titulo-tarjeta" className="text-xl">
            Tarjeta actual
          </h2>
          <p className="numeros text-sm text-arena" aria-live="polite">
            <span className="text-marfil">{p.mostrados}</span> de {p.necesarios}
          </p>
        </div>
        <GrillaSellos
          total={p.necesarios}
          premios={p.etapas.map((e) => e.corte)}
          llenos={p.mostrados}
          nuevos={nuevos}
          className="mt-4"
        />
        <p className="mt-4 text-sm text-arena">
          {p.proxima
            ? `Le ${p.faltan === 1 ? "falta" : "faltan"} ${textoCortes(p.faltan)} para: ${p.proxima.descripcion}.`
            : `Completó la tarjeta: ${cliente.descripcion_premio ?? p.etapas.at(-1)?.descripcion}.`}
        </p>
        <ListaPremios disponibles={p.disponibles} prefijo="Tiene para canjear:" />
      </div>

      {activa ? (
        <>
          <TarjetaMensualidad
            incluidos={activa.incluidos}
            usos={activa.usos}
            desde={activa.desde}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BotonUsarMensualidad
              cliente={cliente}
              quedan={activa.incluidos - activa.usos.length}
            />
            <BotonCanjear
              primerNombre={primerNombre ?? cliente.nombre}
              disponibles={p.disponibles}
              pendiente={canjear.pendiente}
              onCanjear={alCanjear}
              siempreVisible
            />
          </div>
        </>
      ) : (
        <>
          <CampoMonto
            valor={sumar.texto}
            onCambio={sumar.cambiar}
            invalido={sumar.invalido}
            medio={sumar.medio}
            onMedio={sumar.elegirMedio}
            faltaMedio={sumar.faltaMedio}
            sinPrecio={!servicioTurno && cliente.precio_habitual === null}
            disabled={sumar.pendiente}
            nota={servicioTurno ? `Precio de su turno: ${servicioTurno.nombre}.` : undefined}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              size="xl"
              variant="neon"
              onClick={alSumar}
              disabled={sumar.pendiente}
              aria-busy={sumar.pendiente || undefined}
            >
              {sumar.pendiente ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Plus aria-hidden />
              )}
              {sumar.pendiente ? "Sumando…" : "Sumar corte"}
            </Button>
            <BotonCanjear
              primerNombre={primerNombre ?? cliente.nombre}
              disponibles={p.disponibles}
              pendiente={canjear.pendiente}
              onCanjear={alCanjear}
              siempreVisible
            />
          </div>
          <DialogoCobrarMensualidad cliente={cliente} precio={mensualidad.precioBarbero} />
        </>
      )}
    </section>
  );
}
