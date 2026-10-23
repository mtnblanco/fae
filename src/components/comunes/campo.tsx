import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  etiqueta: string;
  errores?: string[];
  ayuda?: ReactNode;
  className?: string;
  /** Recibe el id del control y los atributos de accesibilidad a aplicarle. */
  children: (control: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
  accion?: ReactNode;
};

/** Etiqueta + control + ayuda + error, conectados por aria-describedby. */
export function Campo({ etiqueta, errores, ayuda, className, children, accion }: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const error = errores?.[0];
  const describedBy =
    [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("grid grid-cols-1 gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-medium text-marfil">
          {etiqueta}
        </Label>
        {accion}
      </div>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {ayuda && !error ? (
        <p id={idAyuda} className="text-[0.8125rem] leading-snug text-arena">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p
          id={idError}
          role="alert"
          className="text-[0.8125rem] leading-snug font-medium text-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
