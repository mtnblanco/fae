"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Franja, franjaSiguiente, generarSlots, opcionesHora } from "@/lib/turnos/franjas";
import { TURNOS } from "@/lib/turnos/reglas";
import { cn } from "@/lib/utils";

const HORAS_DESDE = opcionesHora("06:00", "23:30");
const HORAS_HASTA = opcionesHora("06:30", "24:00");

const claseSelect =
  "numeros h-11 w-full min-w-0 appearance-none rounded-lg border border-input bg-noche/60 px-3 text-center text-base text-marfil outline-none transition-colors hover:border-arena/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Franjas de un día: desde / hasta / cada 30 o 60, con agregar y quitar. */
export function EditorFranjas({
  franjas,
  onChange,
  etiqueta,
}: {
  franjas: Franja[];
  onChange: (franjas: Franja[]) => void;
  /** "lunes", "el día especial"… (para los lectores de pantalla). */
  etiqueta: string;
}) {
  const cambiar = (i: number, cambio: Partial<Franja>) =>
    onChange(franjas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));

  return (
    <div className="grid grid-cols-1 gap-3">
      {franjas.map((f, i) => {
        const turnos = generarSlots(f).length;
        return (
          <div
            key={i}
            className="grid grid-cols-1 gap-2 rounded-lg border border-hierro bg-noche/40 p-2.5"
          >
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <select
                aria-label={`Desde (${etiqueta}, franja ${i + 1})`}
                value={f.desde}
                onChange={(e) => cambiar(i, { desde: e.target.value })}
                className={claseSelect}
              >
                {HORAS_DESDE.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-sm text-arena">a</span>
              <select
                aria-label={`Hasta (${etiqueta}, franja ${i + 1})`}
                value={f.hasta}
                onChange={(e) => cambiar(i, { hasta: e.target.value })}
                className={claseSelect}
              >
                {HORAS_HASTA.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Quitar franja ${i + 1} (${etiqueta})`}
                onClick={() => onChange(franjas.filter((_, j) => j !== i))}
              >
                <X aria-hidden />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-arena">Turnos de</span>
              <div role="group" aria-label="Duración del turno" className="flex gap-1">
                {TURNOS.duraciones.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={f.duracion_min === d}
                    onClick={() => cambiar(i, { duracion_min: d })}
                    className={cn(
                      "numeros h-10 rounded-md border px-3 text-sm font-medium transition-colors",
                      f.duracion_min === d
                        ? "border-oro-claro bg-ebano-claro text-oro-claro"
                        : "border-hierro text-arena hover:text-marfil",
                    )}
                  >
                    {d} min
                  </button>
                ))}
              </div>
              <span className="numeros ml-auto text-sm text-arena">
                {turnos === 1 ? "1 turno" : `${turnos} turnos`}
              </span>
            </div>
          </div>
        );
      })}
      <Button
        variant="ghost"
        className="h-11 w-fit px-2 text-oro hover:text-oro-claro"
        onClick={() => onChange([...franjas, franjaSiguiente(franjas)])}
      >
        <Plus aria-hidden />
        Agregar franja
      </Button>
    </div>
  );
}
