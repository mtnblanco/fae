import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icono: LucideIcon;
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
  className?: string;
};

export function EstadoVacio({ icono: Icono, titulo, descripcion, accion, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-hierro px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-ebano-claro text-oro">
        <Icono className="size-5" aria-hidden />
      </span>
      <p className="font-titulo text-xl text-marfil">{titulo}</p>
      {descripcion ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-arena">{descripcion}</p>
      ) : null}
      {accion ? <div className="mt-5">{accion}</div> : null}
    </div>
  );
}
