import { Check, Gift } from "lucide-react";
import { type Etapa, ordinal } from "@/lib/progreso";
import { cn } from "@/lib/utils";

type Props = {
  etapas: Etapa[];
  /** Sellos de la tarjeta actual: las etapas hasta ahí se marcan como alcanzadas. */
  alcanzados?: number;
  className?: string;
};

/**
 * Las etapas de la tarjeta como un recorrido: en qué corte se gana cada premio.
 * Sin brillo (la luz de cada pantalla está en otro lado): oro y marfil.
 */
export function ListaEtapas({ etapas, alcanzados, className }: Props) {
  return (
    <ol className={cn("relative grid grid-cols-1 gap-2", className)}>
      {/* El hilo que une las etapas, detrás de los íconos. */}
      {etapas.length > 1 ? (
        <span
          aria-hidden
          className="absolute top-7 bottom-7 left-[1.875rem] w-px bg-gradient-to-b from-oro/50 via-oro/25 to-oro/50"
        />
      ) : null}
      {etapas.map((e) => {
        const lograda = alcanzados !== undefined && e.corte <= alcanzados;
        return (
          <li
            key={e.corte}
            className="relative flex items-center gap-3 rounded-xl border border-hierro bg-ebano px-3.5 py-3"
          >
            <span
              className={cn(
                "relative flex size-9 shrink-0 items-center justify-center rounded-full border",
                lograda
                  ? "border-oro bg-oro text-primary-foreground"
                  : "border-dashed border-oro/55 bg-ebano text-oro/85",
              )}
            >
              {lograda ? (
                <Check className="size-4" strokeWidth={2.75} aria-hidden />
              ) : (
                <Gift className="size-4" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="etiqueta block text-arena">
                {ordinal(e.corte)} corte
                {lograda ? (
                  <span className="sr-only"> (ya lo alcanzaste en esta tarjeta)</span>
                ) : null}
              </span>
              <span className="block leading-snug break-words text-marfil">{e.descripcion}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
