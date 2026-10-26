"use client";

import { CalendarX2, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { reservarTurno } from "@/app/turnos/acciones";
import { Button } from "@/components/ui/button";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import { formatearPesos } from "@/lib/dinero";
import {
  etiquetaDia,
  momentoDelDia,
  nombreRelativo,
  partesDia,
  type MomentoDelDia,
} from "@/lib/turnos/fechas";
import { textoServicio } from "@/lib/turnos/servicios";
import { cn } from "@/lib/utils";
import { SelectorServicio, type ServicioTurno } from "./selector-servicio";
import { TiraDias } from "./tira-dias";

export type HorarioLibre = { inicio: string; fecha: string; hora: string; duracion: number };

type Props = {
  barberoId: string;
  barberoNombre: string;
  hoy: string;
  dias: string[];
  horarios: HorarioLibre[];
  /** Servicios activos del barbero. Si hay, el cliente tiene que elegir uno. */
  servicios: ServicioTurno[];
  sede: string;
  whatsapp: string | null;
};

const MOMENTOS: MomentoDelDia[] = ["Mañana", "Tarde", "Noche"];

/**
 * Servicio (si el barbero cargó) → día (tira deslizable) → horario (chips) →
 * barra fija para confirmar.
 */
export function SelectorHorario({
  barberoId,
  barberoNombre,
  hoy,
  dias,
  horarios,
  servicios,
  sede,
  whatsapp,
}: Props) {
  const router = useRouter();
  const { pendiente, ejecutar } = useAccionUnica();

  const porDia = useMemo(() => {
    const mapa = new Map<string, HorarioLibre[]>(dias.map((d) => [d, []]));
    for (const h of horarios) mapa.get(h.fecha)?.push(h);
    return mapa;
  }, [dias, horarios]);
  const sinHorarios = useMemo(
    () => new Set(dias.filter((d) => (porDia.get(d)?.length ?? 0) === 0)),
    [dias, porDia],
  );
  const primerDiaConHorarios = dias.find((d) => !sinHorarios.has(d)) ?? null;

  const [dia, setDia] = useState(primerDiaConHorarios ?? dias[0]!);
  const [elegido, setElegido] = useState<string | null>(null);
  // Con un solo servicio, ya viene elegido.
  const [servicioId, setServicioId] = useState<string | null>(
    servicios.length === 1 ? servicios[0]!.id : null,
  );
  const pideServicio = servicios.length > 0;
  // Si el servicio elegido dejó de ofrecerse (y se recargó la lista), se deselecciona solo.
  const servicio = servicios.find((s) => s.id === servicioId) ?? null;
  const eligiendoServicio = pideServicio && !servicio;

  const delDia = porDia.get(dia) ?? [];
  // Si el horario elegido se ocupó (y se recargó la lista), se deselecciona solo.
  const horario = delDia.find((h) => h.inicio === elegido) ?? null;
  // Para "probá el jueves": el próximo día con horarios (o, si no hay, el anterior más cercano).
  const siguiente =
    dias.find((d) => d > dia && !sinHorarios.has(d)) ??
    dias.findLast((d) => d < dia && !sinHorarios.has(d)) ??
    null;

  function elegirDia(d: string) {
    setDia(d);
    setElegido(null);
  }

  const confirmar = () => {
    if (!horario || eligiendoServicio) return;
    ejecutar(async (solicitudId) => {
      const r = await reservarTurno({
        barberoId,
        inicio: horario.inicio,
        servicioId: servicio?.id ?? null,
        solicitudId,
      });
      if (r.ok) {
        router.push("/turnos/confirmado");
        return;
      }
      toast.error(r.error);
      if (r.recargar) {
        setElegido(null);
        router.refresh();
      }
    });
  };

  if (!primerDiaConHorarios) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-hierro px-6 py-10 text-center">
        <CalendarX2 className="mb-4 size-6 text-oro" aria-hidden />
        <p className="font-titulo text-xl text-marfil">Sin horarios libres por ahora</p>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-arena">
          {barberoNombre} no tiene horarios libres en los próximos 14 días.
        </p>
        {whatsapp ? (
          <Button asChild variant="oro" className="mt-5">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden />
              Escribinos por WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  if (eligiendoServicio) {
    return (
      <section aria-labelledby="titulo-servicio" className="grid grid-cols-1 gap-3">
        <h2 id="titulo-servicio" className="font-sans text-[0.9375rem] font-medium text-marfil">
          ¿Qué te hacés?
        </h2>
        <SelectorServicio servicios={servicios} elegido={servicioId} onElegir={setServicioId} />
        <p className="text-[0.8125rem] text-arena">
          Precios de {barberoNombre}. Después elegís el día y el horario.
        </p>
      </section>
    );
  }

  return (
    <>
      {servicio ? (
        <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-hierro bg-ebano px-4 py-2">
          <p className="min-w-0 text-[0.9375rem]">
            <span className="block truncate text-marfil">{servicio.nombre}</span>
            <span className="numeros block text-sm text-oro-claro">
              {formatearPesos(servicio.precio)}
            </span>
          </p>
          {servicios.length > 1 ? (
            <Button
              variant="ghost"
              className="-mr-2 shrink-0 text-oro-claro"
              onClick={() => setServicioId(null)}
            >
              Cambiar
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        <p className="etiqueta text-arena" aria-live="polite">
          {partesDia(dia).mesLargo}
        </p>
        <TiraDias
          dias={dias}
          elegido={dia}
          onElegir={elegirDia}
          hoy={hoy}
          apagados={sinHorarios}
          etiqueta="Elegí el día"
        />
      </div>

      {delDia.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hierro px-5 py-8 text-center">
          <p className="font-titulo text-xl text-marfil">
            {dia === hoy ? "Ya no quedan horarios para hoy" : "No hay horarios este día"}
          </p>
          {siguiente ? (
            <>
              <p className="mt-1.5 text-sm text-arena">Probá {nombreRelativo(siguiente, hoy)}.</p>
              <Button variant="oro" className="mt-4 h-12" onClick={() => elegirDia(siguiente)}>
                Ver {etiquetaDia(siguiente, hoy).toLowerCase()}
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5" role="group" aria-label="Elegí el horario">
          {MOMENTOS.map((momento) => {
            const lista = delDia.filter((h) => momentoDelDia(h.hora) === momento);
            if (lista.length === 0) return null;
            return (
              <section key={momento} aria-label={momento}>
                <h2 className="mb-2 font-sans text-sm font-medium text-arena">{momento}</h2>
                <ul className="grid grid-cols-3 gap-2">
                  {lista.map((h) => {
                    const activo = h.inicio === elegido;
                    return (
                      <li key={h.inicio}>
                        <button
                          type="button"
                          aria-pressed={activo}
                          onClick={() => setElegido(activo ? null : h.inicio)}
                          className={cn(
                            "numeros h-12 w-full rounded-lg border text-base font-medium transition-colors",
                            activo
                              ? "border-oro-claro bg-ebano-claro text-oro-claro"
                              : "border-hierro bg-ebano text-marfil active:bg-ebano-claro",
                          )}
                        >
                          {h.hora}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="text-[0.8125rem] text-arena">
            {sede}. Podés cancelar desde la web hasta 6 horas antes.
          </p>
        </div>
      )}

      {/* Espacio para que la barra fija no tape el último horario. */}
      {horario ? <div aria-hidden className={servicio ? "h-44" : "h-36"} /> : null}

      {horario ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-hierro bg-noche px-(--gutter) pt-3"
          style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto grid max-w-md grid-cols-1 gap-2.5">
            <p className="numeros text-center text-[0.9375rem] text-marfil" aria-live="polite">
              {etiquetaDia(horario.fecha, hoy)} · {horario.hora} · con {barberoNombre}
              <span className="text-arena"> · {horario.duracion} min</span>
              {servicio ? (
                <span className="block text-oro-claro">
                  {textoServicio(servicio.nombre, servicio.precio)}
                </span>
              ) : null}
            </p>
            <Button
              variant="neon"
              size="xl"
              className="w-full"
              disabled={pendiente}
              onClick={confirmar}
            >
              {pendiente ? "Reservando…" : "Confirmar turno"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
