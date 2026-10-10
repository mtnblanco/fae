import { Gift, ScanLine, Scissors, Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Button } from "@/components/ui/button";
import { requireBarbero } from "@/lib/auth";
import { actividadReciente, clientesConPremio, obtenerMetricas } from "@/lib/datos/panel";
import { hoyISO, nombreDelMes, tiempoRelativo } from "@/lib/fechas";
import { RUTAS, rutaCliente } from "@/lib/rutas";
import { saludo } from "@/lib/saludo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

export default async function PaginaPanel() {
  const { perfil } = await requireBarbero();
  const [metricas, actividad, conPremio] = await Promise.all([
    obtenerMetricas(),
    actividadReciente(),
    clientesConPremio(),
  ]);
  const mes = nombreDelMes();
  // Mes anterior según la fecha argentina (el servidor corre en UTC).
  const [anio, mesNum] = hoyISO().split("-").map(Number);
  const mesAnterior = nombreDelMes(new Date(Date.UTC(anio!, mesNum! - 2, 15)));

  const indicadores = [
    {
      etiqueta: "Clientes",
      valor: metricas.clientes_total,
      detalle:
        metricas.clientes_nuevos_mes > 0
          ? `${metricas.clientes_nuevos_mes} nuevos en ${mes}`
          : "Sin altas este mes",
    },
    {
      etiqueta: `Cortes en ${mes}`,
      valor: metricas.cortes_mes,
      detalle: `${metricas.cortes_mes_anterior} en ${mesAnterior}`,
    },
    {
      etiqueta: `Premios canjeados en ${mes}`,
      valor: metricas.canjes_mes,
      detalle: `${metricas.canjes_total} en total`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-10">
      <section aria-labelledby="titulo-saludo" className="grid grid-cols-1 gap-5">
        <h1 id="titulo-saludo" className="text-[2rem] leading-[1.1] sm:text-[2.5rem]">
          {saludo()}, {perfil.nombre.split(" ")[0]}
        </h1>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Button asChild size="xl" className="w-full">
            <Link href={RUTAS.escanear}>
              <ScanLine aria-hidden />
              Escanear carnet
            </Link>
          </Button>
          <div className="grid grid-cols-2 gap-3 sm:contents">
            <Button asChild size="xl" variant="outline" className="w-full">
              <Link href={`${RUTAS.clientes}/nuevo`}>
                <UserPlus aria-hidden />
                Nuevo cliente
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="w-full">
              <Link href={RUTAS.clientes}>
                <Search aria-hidden />
                Buscar
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="titulo-resumen">
        <h2 id="titulo-resumen" className="sr-only">
          Resumen
        </h2>
        <dl className="grid grid-cols-1 divide-y divide-cuero rounded-xl border border-cuero bg-nogal sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {indicadores.map((ind) => (
            <div
              key={ind.etiqueta}
              className="flex items-baseline justify-between gap-4 px-5 py-4 sm:block sm:py-5"
            >
              <dt className="text-sm text-arena first-letter:uppercase">{ind.etiqueta}</dt>
              <dd className="text-right sm:mt-2 sm:text-left">
                <span className="numeros font-titulo text-3xl text-marfil sm:text-[2.5rem] sm:leading-none">
                  {ind.valor}
                </span>
                <span className="mt-1 block text-[0.8125rem] text-arena">{ind.detalle}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-8">
        <section aria-labelledby="titulo-premios">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="titulo-premios" className="text-2xl">
              Premios pendientes
            </h2>
            {metricas.premios_pendientes > 0 ? (
              <Link
                href={`${RUTAS.clientes}?filtro=con-premio`}
                className="shrink-0 rounded-md text-sm whitespace-nowrap text-bronce underline-offset-4 hover:underline"
              >
                Ver todos ({metricas.premios_pendientes})
              </Link>
            ) : null}
          </div>
          {conPremio.length === 0 ? (
            <EstadoVacio
              icono={Gift}
              titulo="Nadie tiene premios pendientes"
              descripcion="Cuando un cliente complete su tarjeta, va a aparecer acá para que no te olvides de canjearlo."
            />
          ) : (
            <ul className="divide-y divide-cuero rounded-xl border border-cuero bg-nogal">
              {conPremio.map((c) => (
                <li key={c.id}>
                  <Link
                    href={rutaCliente(c.id)}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-nogal-claro"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bronce/15 text-bronce">
                        <Gift className="size-4" aria-hidden />
                      </span>
                      <span className="truncate text-marfil">{c.nombre}</span>
                    </span>
                    <span className="shrink-0 text-sm text-bronce">
                      {c.premios_disponibles === 1
                        ? "1 premio"
                        : `${c.premios_disponibles} premios`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titulo-actividad">
          <h2 id="titulo-actividad" className="mb-4 text-2xl">
            Actividad reciente
          </h2>
          {actividad.length === 0 ? (
            <EstadoVacio
              icono={Scissors}
              titulo="Todavía no hay movimientos"
              descripcion="Escaneá el carnet de un cliente para cargar su primer corte."
            />
          ) : (
            <ul className="divide-y divide-cuero rounded-xl border border-cuero bg-nogal">
              {actividad.map((a) => (
                <li key={`${a.tipo}-${a.id}`}>
                  <Link
                    href={rutaCliente(a.clienteId)}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-nogal-claro"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        a.tipo === "corte"
                          ? "bg-nogal-claro text-arena"
                          : "bg-bronce/15 text-bronce",
                      )}
                    >
                      {a.tipo === "corte" ? (
                        <Scissors className="size-4" aria-hidden />
                      ) : (
                        <Gift className="size-4" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-marfil">{a.clienteNombre}</span>
                      <span className="block truncate text-[0.8125rem] text-arena">
                        {a.tipo === "corte" ? "Corte" : `Canjeó: ${a.detalle}`}
                      </span>
                    </span>
                    <time dateTime={a.fecha} className="shrink-0 text-[0.8125rem] text-arena">
                      {tiempoRelativo(a.fecha)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
