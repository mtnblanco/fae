"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { MENSAJE_MONTO_INVALIDO } from "@/lib/dinero";
import { cn } from "@/lib/utils";

type Props = {
  valor: string;
  onCambio: (valor: string) => void;
  invalido?: boolean;
  /** Si el cliente no tiene precio habitual, se avisa debajo. */
  sinPrecio?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Lo que se le cobra al cliente, precargado con su precio habitual. Se puede
 * tocar y cambiar en el momento (teclado numérico); vacío = sin monto.
 */
export function CampoMonto({ valor, onCambio, invalido, sinPrecio, disabled, className }: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const ayuda = invalido
    ? MENSAJE_MONTO_INVALIDO
    : sinPrecio && !valor
      ? "No tiene precio cargado: escribí cuánto te pagó."
      : null;

  return (
    <div className={cn("rounded-xl border border-hierro bg-ebano px-4 py-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[0.9375rem] font-medium text-marfil">
          Cobrás
        </label>
        <div className="relative w-44 max-w-[60%]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg font-semibold text-arena"
          >
            $
          </span>
          <Input
            id={id}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="Sin monto"
            value={valor}
            onChange={(e) => onCambio(e.target.value)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            aria-invalid={invalido || undefined}
            aria-describedby={ayuda ? idAyuda : undefined}
            className="numeros h-12 pl-8 text-right text-2xl font-semibold text-marfil placeholder:text-base placeholder:font-normal"
          />
        </div>
      </div>
      {ayuda ? (
        <p
          id={idAyuda}
          role={invalido ? "alert" : undefined}
          className={cn(
            "mt-2 text-[0.8125rem] leading-snug",
            invalido ? "font-medium text-error" : "text-arena",
          )}
        >
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
