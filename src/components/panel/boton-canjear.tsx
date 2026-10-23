"use client";

import { Gift, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ordinal, type PremioDisponible } from "@/lib/progreso";
import { cn } from "@/lib/utils";

type Props = {
  primerNombre: string;
  disponibles: PremioDisponible[];
  pendiente: boolean;
  /** Recibe la etapa (corte n.º) del premio elegido. */
  onCanjear: (etapa: number) => void;
  /** Mostrar el botón aunque no haya premios (deshabilitado). */
  siempreVisible?: boolean;
};

/**
 * "Canjear premio" con confirmación. Si el cliente tiene premios de más de una
 * etapa, el barbero elige cuál usa (ninguno viene marcado, para no canjear el
 * equivocado por apuro).
 */
export function BotonCanjear({
  primerNombre,
  disponibles,
  pendiente,
  onCanjear,
  siempreVisible = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<number | null>(null);
  const unico = disponibles.length === 1 ? disponibles[0]! : null;
  const seleccion = unico
    ? unico.corte
    : disponibles.some((d) => d.corte === elegida)
      ? elegida
      : null;
  const total = disponibles.reduce((s, d) => s + d.cantidad, 0);

  if (disponibles.length === 0 && !siempreVisible) return null;

  return (
    <AlertDialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (v) setElegida(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button size="xl" variant="oro" disabled={disponibles.length === 0 || pendiente}>
          {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Gift aria-hidden />}
          {pendiente ? "Canjeando…" : "Canjear premio"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md p-5 data-[size=default]:max-w-md data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-titulo text-2xl font-normal">
            {unico ? "¿Canjear el premio?" : "¿Qué premio usa?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[0.9375rem] leading-relaxed text-arena">
            {unico
              ? `${primerNombre} va a usar su premio: ${unico.descripcion}. No se puede deshacer.`
              : `${primerNombre} tiene ${total} premios. Elegí cuál usa hoy; no se puede deshacer.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {unico ? null : (
          <fieldset className="grid grid-cols-1 gap-2">
            <legend className="sr-only">Premio a canjear</legend>
            {disponibles.map((d) => (
              <label
                key={d.corte}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors",
                  seleccion === d.corte
                    ? "border-oro bg-oro/10"
                    : "border-hierro-claro hover:border-oro/60 hover:bg-ebano-claro",
                )}
              >
                <input
                  type="radio"
                  name="premio-a-canjear"
                  value={d.corte}
                  checked={seleccion === d.corte}
                  onChange={() => setElegida(d.corte)}
                  className="size-5 shrink-0 accent-oro"
                />
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug break-words text-marfil">
                    {d.descripcion}
                  </span>
                  <span className="etiqueta block text-arena">{ordinal(d.corte)} corte</span>
                </span>
                {d.cantidad > 1 ? (
                  <span className="numeros shrink-0 text-sm font-semibold text-oro-claro">
                    ×{d.cantidad}
                  </span>
                ) : null}
              </label>
            ))}
          </fieldset>
        )}

        <AlertDialogFooter className="-mx-5 -mb-5 p-4">
          <AlertDialogCancel variant="outline">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={seleccion === null}
            onClick={() => {
              if (seleccion !== null) onCanjear(seleccion);
            }}
          >
            Sí, canjear
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Premios para canjear: uno por etapa, con la cantidad si hay más de uno. */
export function ListaPremios({
  disponibles,
  prefijo,
}: {
  disponibles: PremioDisponible[];
  /** Texto antes de la lista, p. ej. "Tiene para canjear:". */
  prefijo?: string;
}) {
  if (disponibles.length === 0) return null;
  return (
    <div className="mt-3">
      {prefijo ? <p className="mb-2 text-sm text-arena">{prefijo}</p> : null}
      <ul className="flex flex-wrap gap-2" aria-label="Premios para canjear">
        {disponibles.map((d) => (
          <li
            key={d.corte}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-oro/40 bg-oro/10 px-3 py-1.5 text-sm font-medium text-oro-claro"
          >
            <Gift className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{d.descripcion}</span>
            {d.cantidad > 1 ? <span className="numeros shrink-0">×{d.cantidad}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
