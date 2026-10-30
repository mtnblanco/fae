"use client";

import { ArrowLeftRight, Banknote } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import type { MedioPago } from "@/lib/database.types";
import { MENSAJE_MONTO_INVALIDO } from "@/lib/dinero";
import { ETIQUETAS_MEDIO, MEDIOS_PAGO, MENSAJE_FALTA_MEDIO } from "@/lib/medios-pago";
import { cn } from "@/lib/utils";

const ICONOS_MEDIO = { efectivo: Banknote, transferencia: ArrowLeftRight } as const;

type Props = {
  valor: string;
  onCambio: (valor: string) => void;
  invalido?: boolean;
  /** Si el cliente no tiene precio habitual, se avisa debajo. */
  sinPrecio?: boolean;
  /** Aclaración debajo (por ejemplo, de dónde sale el precio precargado). */
  nota?: string;
  /** Medio de pago elegido. Se pide solo si hay algo escrito en el monto. */
  medio: MedioPago | null;
  onMedio: (medio: MedioPago) => void;
  /** Se intentó cobrar sin elegir el medio de pago. */
  faltaMedio?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Lo que se le cobra al cliente, precargado con su precio habitual. Se puede
 * tocar y cambiar en el momento (teclado numérico); vacío = sin monto. Si hay
 * monto, se marca cómo pagó (efectivo o transferencia).
 */
export function CampoMonto({
  valor,
  onCambio,
  invalido,
  sinPrecio,
  nota,
  medio,
  onMedio,
  faltaMedio,
  disabled,
  className,
}: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idMedio = `${id}-medio`;
  const conMonto = valor.trim() !== "";
  const ayuda = invalido
    ? MENSAJE_MONTO_INVALIDO
    : sinPrecio && !valor
      ? "No tiene precio cargado: escribí cuánto te pagó."
      : (nota ?? null);

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
      {conMonto ? (
        <div className="mt-3">
          <p id={idMedio} className="sr-only">
            Medio de pago
          </p>
          <div
            role="radiogroup"
            aria-labelledby={idMedio}
            aria-invalid={faltaMedio || undefined}
            className="grid grid-cols-2 gap-2"
          >
            {MEDIOS_PAGO.map((m) => {
              const Icono = ICONOS_MEDIO[m];
              const elegido = medio === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  disabled={disabled}
                  onClick={() => onMedio(m)}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-2 text-[0.9375rem] font-medium transition-colors disabled:opacity-60",
                    elegido
                      ? "border-oro bg-oro/15 text-oro-claro"
                      : faltaMedio
                        ? "border-error/70 text-marfil"
                        : "border-hierro-claro text-arena hover:border-arena/60 hover:text-marfil",
                  )}
                >
                  <Icono className="size-4" aria-hidden />
                  {ETIQUETAS_MEDIO[m]}
                </button>
              );
            })}
          </div>
          {faltaMedio && !medio ? (
            <p role="alert" className="mt-2 text-[0.8125rem] font-medium text-error">
              {MENSAJE_FALTA_MEDIO}
            </p>
          ) : null}
        </div>
      ) : null}
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
