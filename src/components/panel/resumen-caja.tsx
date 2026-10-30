import type { FilaFacturacion } from "@/lib/database.types";
import { sumarCaja } from "@/lib/caja";
import { formatearPesos } from "@/lib/dinero";
import { textoCortes } from "@/lib/progreso";

const textoServicios = (n: number) =>
  n === 1 ? "1 servicio sin cliente" : `${n} servicios sin cliente`;

const textoMensualidades = (n: number) => (n === 1 ? "1 mensualidad" : `${n} mensualidades`);

/** "10 cortes, 2 sin monto · 3 servicios sin cliente · 1 mensualidad" (sin partes vacías). */
function detalle(f: {
  cortes: number;
  sinMonto: number;
  servicios: number;
  mensualidades: number;
  cortesMensuales: number;
}): string {
  const partes = [`${textoCortes(f.cortes)}${f.sinMonto > 0 ? `, ${f.sinMonto} sin monto` : ""}`];
  if (f.cortesMensuales > 0)
    partes.push(
      f.cortesMensuales === 1 ? "1 corte de mensualidad" : `${f.cortesMensuales} de mensualidad`,
    );
  if (f.servicios > 0) partes.push(textoServicios(f.servicios));
  if (f.mensualidades > 0) partes.push(textoMensualidades(f.mensualidades));
  return partes.join(" · ");
}

/** Total cobrado en un período, por medio de pago y por barbero. Solo lo ve el dueño. */
export function ResumenCaja({ filas }: { filas: FilaFacturacion[] }) {
  const totales = sumarCaja(filas);
  const medios = [
    { etiqueta: "Efectivo", monto: totales.efectivo },
    { etiqueta: "Transferencia", monto: totales.transferencia },
    // Cortes cargados antes de que se pidiera el medio de pago.
    ...(totales.sinMedio > 0 ? [{ etiqueta: "Sin dato", monto: totales.sinMedio }] : []),
  ];

  return (
    <div className="rounded-xl border border-hierro bg-ebano">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hierro px-5 py-4">
        <div>
          <p className="etiqueta text-arena">Total cobrado</p>
          <p className="mt-0.5 text-[0.8125rem] text-arena">
            {detalle({ ...totales, sinMonto: 0 })}
            {totales.promedio !== null ? ` · promedio ${formatearPesos(totales.promedio)}` : ""}
          </p>
        </div>
        <p className="numeros text-[1.75rem] leading-none font-semibold tracking-[-0.01em] whitespace-nowrap text-oro-claro sm:text-[2.25rem]">
          {formatearPesos(totales.total)}
        </p>
      </div>
      <dl
        className="grid divide-x divide-hierro border-b border-hierro"
        style={{ gridTemplateColumns: `repeat(${medios.length}, minmax(0, 1fr))` }}
      >
        {medios.map((m) => (
          <div key={m.etiqueta} className="min-w-0 px-4 py-3 sm:px-5">
            <dt className="truncate text-[0.8125rem] text-arena">{m.etiqueta}</dt>
            <dd className="numeros mt-0.5 truncate font-medium text-marfil">
              {formatearPesos(m.monto)}
            </dd>
          </div>
        ))}
      </dl>
      <ul className="divide-y divide-hierro">
        {filas.map((f) => (
          <li
            key={f.barbero_id ?? "sin-barbero"}
            className="flex items-center justify-between gap-4 px-5 py-3.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-marfil">
                {f.barbero_nombre ?? "Sin barbero"}
                {f.es_admin ? (
                  <span className="ml-2 text-[0.8125rem] text-arena">Admin</span>
                ) : f.es_dueno ? (
                  <span className="ml-2 text-[0.8125rem] text-arena">Dueño</span>
                ) : null}
              </span>
              <span className="block text-[0.8125rem] text-arena">
                {detalle({
                  cortes: f.cortes,
                  sinMonto: f.cortes_sin_monto,
                  servicios: f.servicios,
                  mensualidades: f.mensualidades,
                  cortesMensuales: f.cortes_mensuales,
                })}
              </span>
              {f.total > 0 ? (
                <span className="numeros block text-[0.8125rem] text-arena">
                  Efectivo {formatearPesos(f.efectivo)} · Transf. {formatearPesos(f.transferencia)}
                </span>
              ) : null}
            </span>
            <span className="numeros shrink-0 font-medium whitespace-nowrap text-marfil">
              {formatearPesos(f.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
