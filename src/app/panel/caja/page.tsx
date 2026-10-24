import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Paginacion } from "@/components/comunes/paginacion";
import { BotonDeshacer } from "@/components/panel/boton-deshacer";
import { ResumenCaja } from "@/components/panel/resumen-caja";
import { requireDueno } from "@/lib/auth";
import { listarCortesPeriodo, nombresBarberos, obtenerFacturacion } from "@/lib/datos/panel";
import { formatearPesos } from "@/lib/dinero";
import { formatearDia, formatearFechaHora, hoyISO } from "@/lib/fechas";
import { ETIQUETAS_PERIODO, esPeriodo, type Periodo, PERIODOS, rangoPeriodo } from "@/lib/periodos";
import { venceDeshacer } from "@/lib/permisos";
import { RUTAS, rutaCliente } from "@/lib/rutas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Caja" };

const valor = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PaginaCaja({ searchParams }: PageProps<"/panel/caja">) {
  const { perfil } = await requireDueno();
  const sp = await searchParams;
  const periodo: Periodo = esPeriodo(valor(sp.periodo)) ? (valor(sp.periodo) as Periodo) : "mes";
  const pagina = Math.max(1, Number.parseInt(valor(sp.pagina) ?? "1", 10) || 1);
  const rango = rangoPeriodo(periodo, hoyISO());

  const href = (cambios: { periodo?: Periodo; pagina?: number }) => {
    const p = new URLSearchParams();
    const todo = { periodo, pagina, ...cambios };
    if (todo.periodo !== "mes") p.set("periodo", todo.periodo);
    if (todo.pagina > 1) p.set("pagina", String(todo.pagina));
    const s = p.toString();
    return s ? `${RUTAS.caja}?${s}` : RUTAS.caja;
  };

  const [filas, listado, barberos] = await Promise.all([
    obtenerFacturacion(rango),
    listarCortesPeriodo(rango, pagina),
    nombresBarberos(),
  ]);

  // eslint-disable-next-line react-hooks/purity -- render del servidor: la hora del request es intencional.
  const ahora = Date.now();

  // Página fuera de rango (URL vieja o editada a mano): vuelve a la primera.
  if (listado.cortes.length === 0 && pagina > 1) redirect(href({ pagina: 1 }));

  const textoRango =
    rango.desde === rango.hasta
      ? formatearDia(rango.desde)
      : `Del ${formatearDia(rango.desde)} al ${formatearDia(rango.hasta)}`;

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6">
      <EncabezadoPagina
        className="mb-0 sm:mb-0"
        titulo="Caja"
        descripcion="Lo que cobró cada barbero. Los cortes cargados sin monto no suman al total."
      />

      <nav
        aria-label="Período"
        className="-mx-(--gutter) w-[calc(100%+2*var(--gutter))] [scrollbar-width:none] overflow-x-auto px-(--gutter) sm:mx-0 sm:w-auto sm:px-0"
      >
        <ul className="flex w-max gap-2">
          {PERIODOS.map((p) => (
            <li key={p}>
              <Link
                href={href({ periodo: p, pagina: 1 })}
                scroll={false}
                aria-current={periodo === p ? "true" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
                  periodo === p
                    ? "border-oro bg-oro/15 text-oro-claro"
                    : "border-hierro-claro text-arena hover:border-arena/60 hover:text-marfil",
                )}
              >
                {ETIQUETAS_PERIODO[p]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="titulo-resumen-caja">
        <h2 id="titulo-resumen-caja" className="mb-3 font-sans text-sm text-arena">
          {textoRango}
        </h2>
        <ResumenCaja filas={filas} />
      </section>

      <section aria-labelledby="titulo-cortes-caja">
        <h2 id="titulo-cortes-caja" className="mb-4 text-2xl">
          Cortes
        </h2>
        {listado.total === 0 ? (
          <EstadoVacio
            icono={Wallet}
            titulo="No hay cortes en este período"
            descripcion="Cuando sumes cortes, van a aparecer acá con lo que pagó cada cliente."
          />
        ) : (
          <ul className="divide-y divide-hierro rounded-xl border border-hierro bg-ebano">
            {listado.cortes.map((c) => {
              const barbero = c.registrado_por ? barberos[c.registrado_por] : undefined;
              const vence = venceDeshacer(perfil, c);
              return (
                <li key={c.id} className="flex items-center">
                  <Link
                    href={rutaCliente(c.clienteId)}
                    className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-ebano-claro"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-marfil">{c.clienteNombre}</span>
                      <span className="block truncate text-[0.8125rem] text-arena">
                        <time dateTime={c.fecha}>{formatearFechaHora(c.fecha)}</time>
                        {` · ${barbero ? barbero.split(" ")[0] : "Sin barbero"}`}
                      </span>
                    </span>
                    {c.monto === null ? (
                      <span className="shrink-0 text-[0.8125rem] text-arena">Sin monto</span>
                    ) : (
                      <span className="numeros shrink-0 font-medium whitespace-nowrap text-marfil">
                        {formatearPesos(c.monto)}
                      </span>
                    )}
                  </Link>
                  {vence !== null && vence > ahora ? (
                    <span className="shrink-0 pr-2">
                      <BotonDeshacer corteId={c.id} vence={vence} />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <Paginacion
          pagina={listado.pagina}
          paginas={listado.paginas}
          total={listado.total}
          porPagina={listado.porPagina}
          hrefPara={(p) => href({ pagina: p })}
          sustantivo={["corte", "cortes"]}
        />
      </section>
    </div>
  );
}
