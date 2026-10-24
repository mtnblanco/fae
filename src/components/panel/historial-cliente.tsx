import { Gift, History, Scissors } from "lucide-react";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { formatearPesos } from "@/lib/dinero";
import { formatearFechaCorta, formatearFechaHora } from "@/lib/fechas";
import { type Barbero, PLAZO_DESHACER_MS, venceDeshacer } from "@/lib/permisos";
import { cn } from "@/lib/utils";
import { BotonDeshacer } from "./boton-deshacer";

type CorteMovimiento = {
  id: string;
  fecha: string;
  monto?: number | null;
  registrado_por?: string | null;
};

type Movimiento =
  | ({ tipo: "corte" } & CorteMovimiento)
  | { tipo: "canje"; id: string; fecha: string; premio: string };

/** Datos extra que muestra el panel (el carnet del cliente no los usa). */
type DetallePanel = {
  /** Quién está mirando: decide si puede deshacer cada corte. */
  barbero: Barbero;
  /** Nombre de cada barbero por id. */
  barberos: Record<string, string>;
  /** Total real de cortes del cliente, para numerarlos. Sin él no se numeran (empleado). */
  totalCortes?: number;
};

const primerNombre = (nombre: string) => nombre.split(" ")[0] ?? nombre;

export function HistorialCliente({
  cortes,
  canjes,
  ahora,
  panel,
  limite,
}: {
  cortes: CorteMovimiento[];
  canjes: { id: string; fecha: string; premio_descripcion: string }[];
  ahora: number;
  /** En el panel: montos, barbero de cada corte y "Deshacer". */
  panel?: DetallePanel;
  /** Cuántos movimientos mostrar (el resto, con "Ver más"). */
  limite?: number;
}) {
  const movimientos: Movimiento[] = [
    ...cortes.map((c) => ({ tipo: "corte" as const, ...c })),
    ...canjes.map((c) => ({
      tipo: "canje" as const,
      id: c.id,
      fecha: c.fecha,
      premio: c.premio_descripcion,
    })),
  ]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, limite);

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
  const totalCortes = panel ? panel.totalCortes : cortes.length;
  let indiceCorte = 0;

  return (
    <ol className="divide-y divide-hierro rounded-xl border border-hierro bg-ebano">
      {movimientos.map((m) => {
        const numero =
          m.tipo === "corte" && totalCortes !== undefined ? totalCortes - indiceCorte++ : null;
        const reciente =
          m.tipo === "corte" && ahora - new Date(m.fecha).getTime() < PLAZO_DESHACER_MS;
        const fecha = reciente ? formatearFechaHora(m.fecha) : formatearFechaCorta(m.fecha);
        const vence =
          panel && m.tipo === "corte"
            ? venceDeshacer(panel.barbero, {
                fecha: m.fecha,
                registrado_por: m.registrado_por ?? null,
              })
            : null;

        let quien: string | null = null;
        if (panel && m.tipo === "corte") {
          const nombre = m.registrado_por ? panel.barberos[m.registrado_por] : undefined;
          quien = nombre ? primerNombre(nombre) : "Sin barbero";
        }

        return (
          <li key={`${m.tipo}-${m.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                m.tipo === "corte" ? "bg-ebano-claro text-arena" : "bg-oro/15 text-oro",
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
                {m.tipo === "corte"
                  ? numero !== null
                    ? `Corte n.º ${numero}`
                    : "Corte"
                  : `Premio canjeado: ${m.premio}`}
              </span>
              <span className="block truncate text-[0.8125rem] text-arena">
                <time dateTime={m.fecha}>{fecha}</time>
                {quien ? ` · ${quien}` : null}
              </span>
            </span>
            {panel && m.tipo === "corte" ? (
              <span className="flex shrink-0 flex-col items-end gap-1">
                {m.monto === null || m.monto === undefined ? (
                  <span className="text-[0.8125rem] text-arena">Sin monto</span>
                ) : (
                  <span className="numeros font-medium whitespace-nowrap text-marfil">
                    {formatearPesos(m.monto)}
                  </span>
                )}
                {vence !== null && vence > ahora ? (
                  <BotonDeshacer corteId={m.id} vence={vence} />
                ) : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
