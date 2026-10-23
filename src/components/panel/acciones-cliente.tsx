"use client";

import { Gift, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { canjearPremio, deshacerCorte } from "@/app/panel/clientes/acciones";
import { Celebracion } from "@/components/carnet/celebracion";
import { GrillaSellos } from "@/components/carnet/sellos";
import { Confirmar } from "@/components/comunes/confirmar";
import { Button } from "@/components/ui/button";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import { useSumarCorte } from "@/hooks/use-sumar-corte";
import { formatearPesos } from "@/lib/dinero";
import { calcularProgreso, textoCortes } from "@/lib/progreso";
import { CampoMonto } from "./campo-monto";

type Props = {
  cliente: {
    id: string;
    nombre: string;
    total_cortes: number;
    sellos_actuales: number;
    premios_disponibles: number;
    cortes_necesarios: number | null;
    descripcion_premio: string | null;
    precio_habitual: number | null;
  };
};

/**
 * Avance de la tarjeta del cliente y acciones del barbero: sumar corte (con el
 * monto precargado con su precio habitual) y canjear premio.
 */
export function AccionesCliente({ cliente }: Props) {
  const p = calcularProgreso(cliente);
  const primerNombre = cliente.nombre.split(" ")[0];
  const sumar = useSumarCorte(cliente.id, cliente.precio_habitual);
  const canjear = useAccionUnica();
  const [confirmarCanje, setConfirmarCanje] = useState(false);
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
      const premiosAhora = datos.cliente?.premios_disponibles ?? 0;
      const completo = premiosAhora > cliente.premios_disponibles;
      if (completo) setFestejo((n) => n + 1);
      const cobrado =
        datos.monto === null ? "Sin monto" : `Cobrado: ${formatearPesos(datos.monto)}`;
      toast.success(
        completo ? `¡${primerNombre} completó la tarjeta!` : `Corte sumado a ${primerNombre}`,
        {
          description: completo ? `${cobrado}. Ya tiene un premio para canjear.` : cobrado,
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

  function alCanjear() {
    canjear.ejecutar(async (solicitudId) => {
      const r = await canjearPremio(cliente.id, solicitudId);
      if (r.ok) toast.success("Premio canjeado", { description: r.datos.premio });
      else toast.error(r.error);
    });
  }

  if (p.necesarios === 0) {
    return (
      <p className="rounded-xl border border-cuero bg-nogal p-5 text-sm text-arena">
        No hay una regla de premios configurada. Configurala en la sección Premios.
      </p>
    );
  }

  return (
    <section aria-labelledby="titulo-tarjeta" className="grid grid-cols-1 gap-4">
      <Celebracion disparo={festejo} />
      <div className="textura-grano rounded-2xl border border-cuero bg-nogal p-5 shadow-suave sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titulo-tarjeta" className="text-xl">
            Tarjeta actual
          </h2>
          <p className="numeros text-sm text-arena" aria-live="polite">
            <span className="text-marfil">{p.mostrados}</span> de {p.necesarios}
          </p>
        </div>
        <GrillaSellos total={p.necesarios} llenos={p.mostrados} nuevos={nuevos} className="mt-4" />
        <p className="mt-4 text-sm text-arena">
          {p.faltan === 0
            ? `Completó la tarjeta: ${cliente.descripcion_premio}.`
            : `Le ${p.faltan === 1 ? "falta" : "faltan"} ${textoCortes(p.faltan)} para: ${cliente.descripcion_premio}.`}
        </p>
        {p.premiosDisponibles > 0 ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-bronce/15 px-3 py-1.5 text-sm font-medium text-bronce-claro">
            <Gift className="size-4" aria-hidden />
            {p.premiosDisponibles === 1
              ? "Tiene 1 premio para canjear"
              : `Tiene ${p.premiosDisponibles} premios para canjear`}
          </p>
        ) : null}
      </div>

      <CampoMonto
        valor={sumar.texto}
        onCambio={sumar.cambiar}
        invalido={sumar.invalido}
        sinPrecio={cliente.precio_habitual === null}
        disabled={sumar.pendiente}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          size="xl"
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
        <Confirmar
          abierto={confirmarCanje}
          onAbiertoChange={setConfirmarCanje}
          disparador={
            <Button
              size="xl"
              variant="outline"
              disabled={p.premiosDisponibles === 0 || canjear.pendiente}
              className="border-bronce/50 text-bronce-claro hover:text-bronce-claro"
            >
              {canjear.pendiente ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Gift aria-hidden />
              )}
              {canjear.pendiente ? "Canjeando…" : "Canjear premio"}
            </Button>
          }
          titulo="¿Canjear el premio?"
          descripcion={`${primerNombre} va a usar su premio: ${cliente.descripcion_premio}. Esta acción no se puede deshacer.`}
          textoConfirmar="Sí, canjear"
          onConfirmar={alCanjear}
        />
      </div>
    </section>
  );
}
