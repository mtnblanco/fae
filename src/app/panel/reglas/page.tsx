import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FormularioRegla } from "@/components/panel/formulario-regla";
import { obtenerReglas } from "@/lib/datos/panel";
import { formatearFechaCorta } from "@/lib/fechas";
import { etapasDe, resumenRegla } from "@/lib/progreso";
import { requireDueno } from "@/lib/auth";

export const metadata: Metadata = { title: "Premios" };

export default async function PaginaReglas() {
  await requireDueno();
  const { activa, historial } = await obtenerReglas();

  return (
    <>
      <EncabezadoPagina
        titulo="Regla de premios"
        descripcion="En qué cortes gana un premio cada cliente, y cuál. Podés poner uno solo o varios en el camino."
      />
      <FormularioRegla etapas={activa ? etapasDe(activa) : [{ corte: 5, descripcion: "" }]} />

      {historial.length > 0 ? (
        <section aria-labelledby="titulo-historial-reglas" className="mt-12">
          <h2 id="titulo-historial-reglas" className="text-2xl">
            Reglas anteriores
          </h2>
          <ul className="mt-4 divide-y divide-hierro rounded-xl border border-hierro bg-ebano">
            {historial.map((r, i) => {
              // Cada regla terminó cuando se creó la siguiente (la más nueva va primero).
              const fin = i === 0 ? activa?.created_at : historial[i - 1]?.created_at;
              return (
                <li
                  key={r.id}
                  className="grid grid-cols-1 gap-0.5 px-4 py-3 text-sm sm:flex sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="text-marfil">{resumenRegla(etapasDe(r))}</span>
                  <span className="shrink-0 text-arena">
                    {formatearFechaCorta(r.created_at)}
                    {fin ? ` al ${formatearFechaCorta(fin)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
