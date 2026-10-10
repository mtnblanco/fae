import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  volver?: ReactNode;
  className?: string;
};

export function EncabezadoPagina({ titulo, descripcion, acciones, volver, className }: Props) {
  return (
    <header className={cn("mb-6 sm:mb-8", className)}>
      {volver ? <div className="mb-3">{volver}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-[2rem] leading-[1.1] text-marfil sm:text-[2.5rem]">{titulo}</h1>
          {descripcion ? (
            <p className="mt-2 max-w-prose text-[0.9375rem] text-arena">{descripcion}</p>
          ) : null}
        </div>
        {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
      </div>
    </header>
  );
}
