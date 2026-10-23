"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { TiraDias } from "@/components/turnos/tira-dias";
import { cn } from "@/lib/utils";

/** Tira de días de la agenda: cambia ?fecha= sin recargar la página. */
export function DiasAgenda({
  dias,
  elegido,
  hoy,
  conTurnos,
}: {
  dias: string[];
  elegido: string;
  hoy: string;
  conTurnos: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  function elegir(dia: string) {
    const nuevos = new URLSearchParams(params);
    if (dia === hoy) nuevos.delete("fecha");
    else nuevos.set("fecha", dia);
    const query = nuevos.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    );
  }

  return (
    <div className={cn("transition-opacity", pendiente && "opacity-70")}>
      <TiraDias
        dias={dias}
        elegido={elegido}
        onElegir={elegir}
        hoy={hoy}
        marcados={new Set(conTurnos)}
        etiqueta="Día de la agenda"
      />
    </div>
  );
}
