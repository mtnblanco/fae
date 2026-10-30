import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Paginacion } from "@/components/comunes/paginacion";
import { BotonDeshacer } from "@/components/panel/boton-deshacer";
import { ExportarCaja } from "@/components/panel/exportar-caja";
import { ResumenCaja } from "@/components/panel/resumen-caja";
import { requireDueno } from "@/lib/auth";
import type { MovimientoCaja } from "@/lib/database.types";
import { listarMovimientosPeriodo, obtenerFacturacion } from "@/lib/datos/panel";
import { formatearPesos } from "@/lib/dinero";
import { formatearDia, formatearFechaHora, hoyISO } from "@/lib/fechas";
import { etiquetaMedio } from "@/lib/medios-pago";
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
  const hoy = hoyISO();
  const rango = rangoPeriodo(periodo, hoy);

  const href = (cambios: { periodo?: Periodo; pagina?: number }) => {
    const p = new URLSearchParams();
    const todo = { periodo, pagina, ...cambios };
    if (todo.periodo !== "mes") p.set("periodo", todo.periodo);
    if (todo.pagina > 1) p.set("pagina", String(todo.pagina));
    const s = p.toString();
    return s ? `${RUTAS.caja}?${s}` : RUTAS.caja;
  };

  const [filas, listado] = await Promise.all([
    obtenerFacturacion(rango),
    listarMovimientosPeriodo(rango, pagina),
  ]);

  // eslint-disable-next-line react-hooks/purity -- render del servidor: la hora del request es intencional.
  const ahora = Date.now();

  // Página fuera de rango (URL vieja o editada a mano): vuelve a la primera.
  if (listado.movimientos.length === 0 && pagina > 1) redirect(href({ pagina: 1 }));

  const textoRango =
    rango.desde === rango.hasta
      ? formatearDia(rango.desde)
      : `Del ${formatearDia(rango.desde)} al ${formatearDia(rango.hasta)}`;

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6">
      <EncabezadoPagina
        className="mb-0 sm:mb-0"
        titulo="Caja"
        descripcion="Lo que cobró cada barbero, en efectivo y por transferencia. Los cortes cargados sin monto no suman al total."
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
          Cobros
        </h2>
        {listado.total === 0 ? (
          <EstadoVacio
            icono={Wallet}
            titulo="No hay cobros en este período"
            descripcion="Cuando sumes cortes o registres servicios, van a aparecer acá con lo que pagó cada uno."
          />
        ) : (
          <ul className="divide-y divide-hierro rounded-xl border border-hierro bg-ebano">
            {listado.movimientos.map((m) => {
              const vence = venceDeshacer(perfil, m);
              return (
                <li key={`${m.tipo}-${m.id}`} className="flex items-center">
                  <FilaMovimiento movimiento={m} />
                  {vence !== null && vence > ahora ? (
                    <span className="shrink-0 pr-2">
                      <BotonDeshacer corteId={m.id} vence={vence} tipo={m.tipo} />
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
          sustantivo={["cobro", "cobros"]}
        />
      </section>

      <section aria-labelledby="titulo-exportar-caja">
        <h2 id="titulo-exportar-caja" className="mb-1 text-2xl">
          Informe para el contador
        </h2>
        <p className="mb-4 text-sm text-arena">Elegí el período y descargalo para mandarlo.</p>
        <ExportarCaja rango={rango} hoy={hoy} />
      </section>
    </div>
  );
}

/** Un corte (lleva a la ficha del cliente) o un servicio sin cliente. */
function FilaMovimiento({ movimiento: m }: { movimiento: MovimientoCaja }) {
  const barbero = m.barbero_nombre ? m.barbero_nombre.split(" ")[0] : "Sin barbero";
  const conCliente = m.tipo !== "servicio";
  const titulo = conCliente
    ? (m.cliente_nombre ?? "Cliente eliminado")
    : (m.servicio_nombre ?? "Servicio");
  const servicio = conCliente
    ? m.servicio_nombre
    : m.cliente_nombre
      ? `Sin cliente registrado · ${m.cliente_nombre}`
      : "Sin cliente registrado";
  const contenido = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-marfil">{titulo}</span>
        <span className="block truncate text-[0.8125rem] text-arena">
          <time dateTime={m.fecha}>{formatearFechaHora(m.fecha)}</time>
          {` · ${barbero}`}
          {servicio ? ` · ${servicio}` : ""}
        </span>
      </span>
      {m.monto === null ? (
        <span className="shrink-0 text-[0.8125rem] text-arena">
          {m.tipo === "mensual" ? "Mensualidad" : "Sin monto"}
        </span>
      ) : (
        <span className="shrink-0 text-right">
          <span className="numeros block font-medium whitespace-nowrap text-marfil">
            {formatearPesos(m.monto)}
          </span>
          <span className="block text-[0.75rem] whitespace-nowrap text-arena">
            {etiquetaMedio(m.medio_pago)}
          </span>
        </span>
      )}
    </>
  );
  const clases = "flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3";
  return conCliente && m.cliente_id ? (
    <Link
      href={rutaCliente(m.cliente_id)}
      className={cn(clases, "transition-colors hover:bg-ebano-claro")}
    >
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}
