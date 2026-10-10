import { UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Paginacion } from "@/components/comunes/paginacion";
import { AvisoEliminado } from "@/components/panel/aviso-eliminado";
import { BuscadorClientes } from "@/components/panel/buscador-clientes";
import { FilaCliente } from "@/components/panel/fila-cliente";
import { Button } from "@/components/ui/button";
import {
  FILTROS_CLIENTES,
  type FiltroClientes,
  listarClientes,
  ORDENES_CLIENTES,
  type OrdenClientes,
} from "@/lib/datos/panel";
import { RUTAS } from "@/lib/rutas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clientes" };

const ETIQUETAS_FILTRO: Record<FiltroClientes, string> = {
  todos: "Todos",
  "con-premio": "Con premio",
  inactivos: "Sin venir hace 30 días",
  nuevos: "Nuevos",
};

const ETIQUETAS_ORDEN: Record<OrdenClientes, string> = {
  "ultima-visita": "Última visita",
  nombre: "Nombre",
  alta: "Fecha de alta",
};

const valor = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PaginaClientes({ searchParams }: PageProps<"/panel/clientes">) {
  const sp = await searchParams;
  const q = valor(sp.q)?.slice(0, 80) ?? "";
  const filtro = (FILTROS_CLIENTES as readonly string[]).includes(valor(sp.filtro) ?? "")
    ? (valor(sp.filtro) as FiltroClientes)
    : "todos";
  const orden = (ORDENES_CLIENTES as readonly string[]).includes(valor(sp.orden) ?? "")
    ? (valor(sp.orden) as OrdenClientes)
    : "ultima-visita";
  const pagina = Math.max(1, Number.parseInt(valor(sp.pagina) ?? "1", 10) || 1);

  const resultado = await listarClientes({ busqueda: q, filtro, orden, pagina });

  const href = (cambios: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const todo = { q, filtro, orden, pagina, ...cambios };
    if (todo.q) p.set("q", String(todo.q));
    if (todo.filtro && todo.filtro !== "todos") p.set("filtro", String(todo.filtro));
    if (todo.orden && todo.orden !== "ultima-visita") p.set("orden", String(todo.orden));
    if (todo.pagina && Number(todo.pagina) > 1) p.set("pagina", String(todo.pagina));
    const s = p.toString();
    return s ? `${RUTAS.clientes}?${s}` : RUTAS.clientes;
  };

  // Página fuera de rango (URL vieja o editada a mano): vuelve a la primera.
  if (resultado.clientes.length === 0 && pagina > 1) redirect(href({ pagina: 1 }));

  const hayBusqueda = Boolean(q) || filtro !== "todos";

  return (
    <>
      <Suspense>
        <AvisoEliminado />
      </Suspense>
      <EncabezadoPagina
        titulo="Clientes"
        acciones={
          <Button asChild>
            <Link href={`${RUTAS.clientes}/nuevo`}>
              <UserPlus aria-hidden />
              Nuevo cliente
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        <Suspense>
          <BuscadorClientes />
        </Suspense>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav
            aria-label="Filtrar clientes"
            className="-mx-(--gutter) w-[calc(100%+2*var(--gutter))] [scrollbar-width:none] overflow-x-auto px-(--gutter) sm:mx-0 sm:w-auto sm:px-0"
          >
            <ul className="flex w-max gap-2">
              {FILTROS_CLIENTES.map((f) => (
                <li key={f}>
                  <Link
                    href={href({ filtro: f, pagina: 1 })}
                    scroll={false}
                    aria-current={filtro === f ? "true" : undefined}
                    className={cn(
                      "inline-flex h-9 items-center rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors",
                      filtro === f
                        ? "border-bronce bg-bronce/15 text-bronce-claro"
                        : "border-cuero text-arena hover:border-arena/50 hover:text-marfil",
                    )}
                  >
                    {ETIQUETAS_FILTRO[f]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Ordenar clientes" className="flex items-center gap-1 text-sm">
            <span className="text-arena">Ordenar:</span>
            {ORDENES_CLIENTES.map((o) => (
              <Link
                key={o}
                href={href({ orden: o, pagina: 1 })}
                scroll={false}
                aria-current={orden === o ? "true" : undefined}
                className={cn(
                  "rounded-md px-2 py-1.5 transition-colors",
                  orden === o
                    ? "text-marfil underline decoration-bronce underline-offset-4"
                    : "text-arena hover:text-marfil",
                )}
              >
                {ETIQUETAS_ORDEN[o]}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <section aria-label="Lista de clientes" className="mt-5">
        {resultado.clientes.length === 0 ? (
          hayBusqueda ? (
            <EstadoVacio
              icono={Users}
              titulo="No encontramos clientes"
              descripcion={
                q
                  ? `Nadie coincide con “${q}”. Probá con otra parte del nombre o del teléfono.`
                  : "Ningún cliente cumple con este filtro por ahora."
              }
              accion={
                <Button asChild variant="outline">
                  <Link href={RUTAS.clientes}>Ver todos los clientes</Link>
                </Button>
              }
            />
          ) : (
            <EstadoVacio
              icono={Users}
              titulo="Todavía no hay clientes"
              descripcion="Dá de alta a tu primer cliente: le generás una contraseña y le pasás los datos por WhatsApp."
              accion={
                <Button asChild>
                  <Link href={`${RUTAS.clientes}/nuevo`}>
                    <UserPlus aria-hidden />
                    Nuevo cliente
                  </Link>
                </Button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-cuero overflow-hidden rounded-xl border border-cuero bg-nogal">
            {resultado.clientes.map((c) => (
              <FilaCliente key={c.id} cliente={c} />
            ))}
          </ul>
        )}

        <Paginacion
          pagina={resultado.pagina}
          paginas={resultado.paginas}
          total={resultado.total}
          porPagina={resultado.porPagina}
          hrefPara={(p) => href({ pagina: p })}
          sustantivo={["cliente", "clientes"]}
        />
      </section>
    </>
  );
}
