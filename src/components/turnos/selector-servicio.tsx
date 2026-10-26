"use client";

import { Check } from "lucide-react";
import { formatearPesos } from "@/lib/dinero";
import { cn } from "@/lib/utils";

export type ServicioTurno = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
};

/** Tarjetas para elegir el servicio (nombre, descripción y precio de este barbero). */
export function SelectorServicio({
  servicios,
  elegido,
  onElegir,
}: {
  servicios: ServicioTurno[];
  elegido: string | null;
  onElegir: (id: string) => void;
}) {
  return (
    <ul role="radiogroup" aria-label="Elegí el servicio" className="grid grid-cols-1 gap-2.5">
      {servicios.map((s) => {
        const activo = s.id === elegido;
        return (
          <li key={s.id}>
            <button
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onElegir(s.id)}
              className={cn(
                "flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                activo
                  ? "border-oro-claro bg-ebano-claro"
                  : "border-hierro bg-ebano hover:border-oro/60 active:bg-ebano-claro",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium break-words text-marfil">{s.nombre}</span>
                {s.descripcion ? (
                  <span className="mt-0.5 block text-sm leading-snug break-words text-arena">
                    {s.descripcion}
                  </span>
                ) : null}
              </span>
              <span className="numeros shrink-0 font-titulo text-xl text-oro-claro">
                {formatearPesos(s.precio)}
              </span>
              {activo ? <Check className="size-5 shrink-0 text-oro-claro" aria-hidden /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
