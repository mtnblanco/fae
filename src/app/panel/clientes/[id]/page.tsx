import { ArrowLeft, ChevronDown, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccionesCliente } from "@/components/panel/acciones-cliente";
import { DialogoEditarCliente } from "@/components/panel/dialogo-editar-cliente";
import { DialogoEliminarCliente } from "@/components/panel/dialogo-eliminar-cliente";
import { DialogoPrecio } from "@/components/panel/dialogo-precio";
import { DialogoResetearPassword } from "@/components/panel/dialogo-resetear-password";
import { Iniciales } from "@/components/panel/fila-cliente";
import { HistorialCliente } from "@/components/panel/historial-cliente";
import { Button } from "@/components/ui/button";
import { requireBarbero } from "@/lib/auth";
import {
  HISTORIAL_MAX,
  HISTORIAL_POR_PAGINA,
  nombresBarberos,
  obtenerCliente,
} from "@/lib/datos/panel";
import { formatearPesos } from "@/lib/dinero";
import { anioDe, tiempoRelativo } from "@/lib/fechas";
import { RUTAS, rutaCliente } from "@/lib/rutas";
import { formatearTelefono, telefonoWhatsApp } from "@/lib/telefono";
import { idSchema } from "@/lib/validaciones";

export async function generateMetadata({
  params,
}: PageProps<"/panel/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return { title: "Cliente" };
  const datos = await obtenerCliente(id);
  return { title: datos?.cliente.nombre ?? "Cliente" };
}

/** `?historial=40` muestra 40 movimientos ("Ver más" suma de a 20). */
function limiteHistorial(valor: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? ""), 10);
  if (!Number.isFinite(n) || n <= HISTORIAL_POR_PAGINA) return HISTORIAL_POR_PAGINA;
  return Math.min(HISTORIAL_MAX, Math.ceil(n / HISTORIAL_POR_PAGINA) * HISTORIAL_POR_PAGINA);
}

export default async function PaginaCliente({
  params,
  searchParams,
}: PageProps<"/panel/clientes/[id]">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const limite = limiteHistorial((await searchParams).historial);
  const [{ perfil }, datos, barberos] = await Promise.all([
    requireBarbero(),
    obtenerCliente(id, limite),
    nombresBarberos(),
  ]);
  if (!datos) notFound();

  const { cliente, cortes, canjes, cortesVisibles, canjesTotal } = datos;
  const esDueno = perfil.es_dueno;
  const totalMovimientos = cortesVisibles + canjesTotal;
  const whatsapp = telefonoWhatsApp(cliente.telefono);
  // eslint-disable-next-line react-hooks/purity -- render del servidor: la hora del request es intencional.
  const ahora = Date.now();

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8">
      <div>
        <Link
          href={RUTAS.clientes}
          className="-mt-2.5 mb-1.5 inline-flex items-center gap-1.5 rounded-md py-2.5 text-sm text-arena transition-colors hover:text-marfil"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Clientes
        </Link>
        <div className="flex items-start gap-4">
          <Iniciales nombre={cliente.nombre} className="size-14 text-xl" />
          <div className="min-w-0">
            <h1 className="text-[2rem] leading-[1.1] break-words">{cliente.nombre}</h1>
            <p className="mt-1.5 text-sm text-arena">
              Cliente desde {anioDe(cliente.created_at)}
              {cliente.ultimo_corte
                ? `, último corte ${tiempoRelativo(cliente.ultimo_corte)}`
                : ", todavía sin cortes"}
            </p>
            {cliente.debe_cambiar_password ? (
              <p className="mt-2 text-[0.8125rem] text-oro">
                Todavía no entró a cambiar su contraseña.
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`tel:${cliente.telefono}`}
            className="numeros inline-flex h-9 items-center gap-2 rounded-full border border-hierro px-3.5 text-sm text-marfil transition-colors hover:bg-ebano-claro"
          >
            <Phone className="size-3.5 text-arena" aria-hidden />
            {formatearTelefono(cliente.telefono)}
          </a>
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-hierro px-3.5 text-sm text-marfil transition-colors hover:bg-ebano-claro"
            >
              <MessageCircle className="size-3.5 text-arena" aria-hidden />
              WhatsApp
            </a>
          ) : null}
          {esDueno ? (
            <DialogoPrecio cliente={cliente} />
          ) : (
            <span className="numeros inline-flex h-9 items-center gap-1.5 rounded-full border border-hierro px-3.5 text-sm text-marfil">
              <span className="text-arena">Precio</span>
              {cliente.precio_habitual === null
                ? "sin cargar"
                : formatearPesos(cliente.precio_habitual)}
            </span>
          )}
        </div>
      </div>

      <AccionesCliente cliente={cliente} />

      <section aria-labelledby="titulo-historial">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="titulo-historial" className="text-2xl">
            Historial
          </h2>
          <p className="text-sm text-arena">
            {cliente.total_cortes === 1 ? "1 corte" : `${cliente.total_cortes} cortes`}
            {cliente.total_canjes > 0
              ? `, ${cliente.total_canjes === 1 ? "1 premio" : `${cliente.total_canjes} premios`}`
              : ""}
          </p>
        </div>
        <HistorialCliente
          cortes={cortes}
          canjes={canjes}
          ahora={ahora}
          limite={limite}
          panel={{
            barbero: { id: perfil.id, es_dueno: esDueno },
            barberos,
            totalCortes: esDueno ? cliente.total_cortes : undefined,
          }}
        />
        {totalMovimientos > limite ? (
          <Button asChild variant="outline" size="lg" className="mt-3 w-full">
            <Link
              href={`${rutaCliente(cliente.id)}?historial=${limite + HISTORIAL_POR_PAGINA}`}
              scroll={false}
              replace
            >
              <ChevronDown aria-hidden />
              Ver más ({totalMovimientos - limite})
            </Link>
          </Button>
        ) : null}
        <p className="mt-3 text-[0.8125rem] text-arena">
          {esDueno
            ? "Podés deshacer cualquier corte de hoy por si hubo un error. Los cortes anteriores a los montos figuran “Sin monto”."
            : "Ves solo los cortes que cargaste vos. Los podés deshacer hasta 10 minutos después de cargarlos."}
        </p>
      </section>

      <section aria-labelledby="titulo-cuenta" className="border-t border-hierro pt-8">
        <h2 id="titulo-cuenta" className="text-2xl">
          Cuenta
        </h2>
        <p className="mt-1 text-sm text-arena">Datos de acceso y gestión del cliente.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <DialogoEditarCliente cliente={cliente} />
          <DialogoResetearPassword cliente={cliente} />
          {esDueno ? <DialogoEliminarCliente cliente={cliente} /> : null}
        </div>
      </section>
    </div>
  );
}
