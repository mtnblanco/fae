"use client";

import { useEffect, useRef } from "react";
import { partesDia } from "@/lib/turnos/fechas";
import { cn } from "@/lib/utils";

type Props = {
  dias: string[];
  elegido: string;
  onElegir: (dia: string) => void;
  hoy: string;
  /** Días que se muestran apagados (sin horarios). */
  apagados?: Set<string>;
  /** Días con un puntito (por ejemplo, con turnos reservados). */
  marcados?: Set<string>;
  etiqueta: string;
};

/** Tira horizontal de días, deslizable, con chips grandes para el dedo. */
export function TiraDias({ dias, elegido, onElegir, hoy, apagados, marcados, etiqueta }: Props) {
  const lista = useRef<HTMLUListElement>(null);

  // Muestra el día elegido aunque esté fuera de la pantalla (sin animar al cargar).
  useEffect(() => {
    const boton = lista.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    boton?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [elegido]);

  return (
    <ul
      ref={lista}
      aria-label={etiqueta}
      className="-mx-(--gutter) flex snap-x snap-mandatory scroll-px-(--gutter) [scrollbar-width:none] gap-2 overflow-x-auto px-(--gutter) pb-1 [&::-webkit-scrollbar]:hidden"
    >
      {dias.map((dia) => {
        const { semana, numero } = partesDia(dia);
        const activo = dia === elegido;
        const apagado = apagados?.has(dia) ?? false;
        return (
          <li key={dia} className="snap-start">
            <button
              type="button"
              aria-pressed={activo}
              aria-label={`${dia === hoy ? "Hoy, " : ""}${semana} ${numero}${apagado ? ", sin horarios" : ""}`}
              onClick={() => onElegir(dia)}
              className={cn(
                "relative flex h-[4.5rem] w-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl border transition-colors",
                activo
                  ? "border-oro-claro bg-ebano-claro text-oro-claro"
                  : "border-hierro bg-ebano text-marfil active:bg-ebano-claro",
                apagado && !activo && "text-ceniza",
              )}
            >
              <span
                className={cn(
                  "etiqueta",
                  !activo && "text-arena",
                  apagado && !activo && "text-ceniza",
                )}
              >
                {dia === hoy ? "HOY" : semana}
              </span>
              <span className="numeros font-titulo text-[1.375rem] leading-none">{numero}</span>
              {marcados?.has(dia) ? (
                <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-oro" />
              ) : apagado ? (
                <span aria-hidden className="absolute bottom-1 text-[0.6875rem] leading-none">
                  —
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
