import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccionesCliente } from "@/components/panel/acciones-cliente";
import { DialogoEditarCliente } from "@/components/panel/dialogo-editar-cliente";
import { DialogoEliminarCliente } from "@/components/panel/dialogo-eliminar-cliente";
import { DialogoResetearPassword } from "@/components/panel/dialogo-resetear-password";
import { Iniciales } from "@/components/panel/fila-cliente";
import { HistorialCliente } from "@/components/panel/historial-cliente";
import { obtenerCliente } from "@/lib/datos/panel";
import { anioDe, formatearFecha, tiempoRelativo } from "@/lib/fechas";
import { RUTAS } from "@/lib/rutas";
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

export default async function PaginaCliente({ params }: PageProps<"/panel/clientes/[id]">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const datos = await obtenerCliente(id);
  if (!datos) notFound();

  const { cliente, cortes, canjes } = datos;
  const whatsapp = telefonoWhatsApp(cliente.telefono);
  // eslint-disable-next-line react-hooks/purity -- render del servidor: la hora del request es intencional.
  const ahora = Date.now();

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8">
      <div>
        <Link
          href={RUTAS.clientes}
          className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-arena transition-colors hover:text-marfil"
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
              <p className="mt-2 text-[0.8125rem] text-bronce">
                Todavía no entró a cambiar su contraseña.
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`tel:${cliente.telefono}`}
            className="numeros inline-flex h-9 items-center gap-2 rounded-full border border-cuero px-3.5 text-sm text-marfil transition-colors hover:bg-nogal-claro"
          >
            <Phone className="size-3.5 text-arena" aria-hidden />
            {formatearTelefono(cliente.telefono)}
          </a>
          {whatsapp ? (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-cuero px-3.5 text-sm text-marfil transition-colors hover:bg-nogal-claro"
            >
              <MessageCircle className="size-3.5 text-arena" aria-hidden />
              WhatsApp
            </a>
          ) : null}
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
        <HistorialCliente cortes={cortes} canjes={canjes} conDeshacer ahora={ahora} />
        {cortes.length > 0 ? (
          <p className="mt-3 text-[0.8125rem] text-arena">
            Primer corte: {formatearFecha(cortes[cortes.length - 1]!.fecha)}. Los cortes se pueden
            deshacer hasta 10 minutos después de cargarlos.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="titulo-cuenta" className="border-t border-cuero pt-8">
        <h2 id="titulo-cuenta" className="text-2xl">
          Cuenta
        </h2>
        <p className="mt-1 text-sm text-arena">Datos de acceso y gestión del cliente.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <DialogoEditarCliente cliente={cliente} />
          <DialogoResetearPassword cliente={cliente} />
          <DialogoEliminarCliente cliente={cliente} />
        </div>
      </section>
    </div>
  );
}
