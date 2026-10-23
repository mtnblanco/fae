"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

/** Segmentado "Vos | Empleado | Ambos" del dueño. Cambia ?ver= (o ?barbero= en horarios). */
export function SelectorBarbero({
  opciones,
  elegido,
  parametro = "ver",
}: {
  opciones: { valor: string; etiqueta: string }[];
  elegido: string;
  parametro?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  function elegir(valor: string) {
    const nuevos = new URLSearchParams(params);
    nuevos.set(parametro, valor);
    startTransition(() => router.replace(`${pathname}?${nuevos.toString()}`, { scroll: false }));
  }

  return (
    <div
      role="group"
      aria-label="Agenda de"
      className={cn(
        "grid gap-1 rounded-xl border border-hierro bg-ebano p-1 transition-opacity",
        pendiente && "opacity-70",
      )}
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o) => {
        const activo = o.valor === elegido;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => elegir(o.valor)}
            className={cn(
              "h-11 truncate rounded-lg px-2 text-[0.9375rem] font-medium transition-colors",
              activo ? "bg-ebano-claro text-oro-claro" : "text-arena hover:text-marfil",
            )}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
