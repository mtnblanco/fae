import type { FilaFacturacion } from "@/lib/database.types";
import { sumarCaja } from "@/lib/caja";
import { formatearPesos } from "@/lib/dinero";
import { textoCortes } from "@/lib/progreso";

/** Total cobrado en un período y el detalle por barbero. Solo lo ve el dueño. */
export function ResumenCaja({ filas }: { filas: FilaFacturacion[] }) {
  const totales = sumarCaja(filas);

  return (
    <div className="rounded-xl border border-cuero bg-nogal">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-cuero px-5 py-4">
        <div>
          <p className="text-sm text-arena">Total cobrado</p>
          <p className="mt-0.5 text-[0.8125rem] text-arena">
            {textoCortes(totales.cortes)}
            {totales.promedio !== null ? ` · promedio ${formatearPesos(totales.promedio)}` : ""}
          </p>
        </div>
        <p className="numeros font-titulo text-[2rem] leading-none whitespace-nowrap text-marfil sm:text-[2.5rem]">
          {formatearPesos(totales.total)}
        </p>
      </div>
      <ul className="divide-y divide-cuero">
        {filas.map((f) => (
          <li
            key={f.barbero_id ?? "sin-barbero"}
            className="flex items-center justify-between gap-4 px-5 py-3.5"
          >
            <span className="min-w-0">
              <span className="block truncate text-marfil">
                {f.barbero_nombre ?? "Sin barbero"}
                {f.es_dueno ? (
                  <span className="ml-2 text-[0.8125rem] text-arena">Dueño</span>
                ) : null}
              </span>
              <span className="block text-[0.8125rem] text-arena">
                {textoCortes(f.cortes)}
                {f.cortes_sin_monto > 0 ? `, ${f.cortes_sin_monto} sin monto` : ""}
              </span>
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
