import { Gift, History, Scissors } from "lucide-react";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { formatearFechaCorta, formatearFechaHora } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { BotonDeshacer } from "./boton-deshacer";

type Movimiento =
  | { tipo: "corte"; id: string; fecha: string }
  | { tipo: "canje"; id: string; fecha: string; premio: string };

const PLAZO_MS = 10 * 60 * 1000;

export function HistorialCliente({
  cortes,
  canjes,
  conDeshacer = false,
  ahora,
}: {
  cortes: { id: string; fecha: string }[];
  canjes: { id: string; fecha: string; premio_descripcion: string }[];
  conDeshacer?: boolean;
  ahora: number;
}) {
  const movimientos: Movimiento[] = [
    ...cortes.map((c) => ({ tipo: "corte" as const, id: c.id, fecha: c.fecha })),
    ...canjes.map((c) => ({
      tipo: "canje" as const,
      id: c.id,
      fecha: c.fecha,
      premio: c.premio_descripcion,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (movimientos.length === 0) {
    return (
      <EstadoVacio
        icono={History}
        titulo="Sin movimientos todavía"
        descripcion="Los cortes y los premios canjeados van a aparecer acá."
      />
    );
  }

  // Número de corte (1 = el primero) para mostrar "Corte n.º 7".
  const totalCortes = cortes.length;
  let indiceCorte = 0;

  return (
    <ol className="divide-y divide-cuero rounded-xl border border-cuero bg-nogal">
      {movimientos.map((m) => {
        const numero = m.tipo === "corte" ? totalCortes - indiceCorte++ : null;
        const reciente = m.tipo === "corte" && ahora - new Date(m.fecha).getTime() < PLAZO_MS;
        return (
          <li key={`${m.tipo}-${m.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                m.tipo === "corte" ? "bg-nogal-claro text-arena" : "bg-bronce/15 text-bronce",
              )}
            >
              {m.tipo === "corte" ? (
                <Scissors className="size-4" aria-hidden />
              ) : (
                <Gift className="size-4" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-marfil">
                {m.tipo === "corte" ? `Corte n.º ${numero}` : `Premio canjeado: ${m.premio}`}
              </span>
              <time dateTime={m.fecha} className="block text-[0.8125rem] text-arena">
                {reciente ? formatearFechaHora(m.fecha) : formatearFechaCorta(m.fecha)}
              </time>
            </span>
            {conDeshacer && reciente ? <BotonDeshacer corteId={m.id} fecha={m.fecha} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
