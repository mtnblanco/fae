import { ArrowLeft, Plus, Scissors } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { AccionesServicio } from "@/components/panel/agenda/acciones-servicio";
import { DialogoServicio } from "@/components/panel/agenda/dialogo-servicio";
import { SelectorBarbero } from "@/components/panel/agenda/selector-barbero";
import { Button } from "@/components/ui/button";
import { requireBarbero } from "@/lib/auth";
import { listarBarberos, serviciosDeBarbero } from "@/lib/datos/turnos";
import { formatearPesos } from "@/lib/dinero";
import { RUTAS } from "@/lib/rutas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Servicios" };

export default async function PaginaServicios({
  searchParams,
}: PageProps<"/panel/agenda/servicios">) {
  const { userId, perfil } = await requireBarbero();
  const sp = await searchParams;

  // Como en Horarios: el empleado edita solo los suyos; el dueño, los de
  // cualquiera (?barbero=). El admin no atiende: arranca por el primero.
  const barberos = perfil.es_dueno ? await listarBarberos() : [];
  const pedido = typeof sp.barbero === "string" ? sp.barbero : userId;
  const barbero =
    (perfil.es_dueno && barberos.find((b) => b.id === pedido)) ||
    (perfil.es_admin ? barberos[0] : { id: userId, nombre: perfil.nombre });
  const volver = (
    <Link
      href={RUTAS.agenda}
      className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-arena transition-colors hover:text-marfil"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Agenda
    </Link>
  );

  if (!barbero) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <EncabezadoPagina className="mb-0 sm:mb-0" titulo="Servicios" volver={volver} />
        <EstadoVacio
          icono={Scissors}
          titulo="Todavía no hay barberos"
          descripcion="Cuando haya un barbero cargado, vas a poder cargar sus servicios acá."
        />
      </div>
    );
  }

  const propio = barbero.id === userId;
  const servicios = await serviciosDeBarbero(barbero.id);
  const activos = servicios.filter((s) => s.activo).length;

  const botonNuevo = (
    <DialogoServicio
      key={barbero.id}
      barberoId={barbero.id}
      disparador={
        <Button>
          <Plus aria-hidden />
          Nuevo servicio
        </Button>
      }
    />
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <EncabezadoPagina
        className="mb-0 sm:mb-0"
        titulo={propio ? "Mis servicios" : `Servicios de ${barbero.nombre.split(" ")[0]}`}
        descripcion={
          propio
            ? "Lo que ofrecés y cuánto cobrás. Al sacar turno con vos, el cliente elige uno y ve el precio."
            : "Al sacar turno con este barbero, el cliente elige uno y ve el precio."
        }
        volver={volver}
        acciones={servicios.length > 0 ? botonNuevo : undefined}
      />

      {perfil.es_dueno && barberos.length > 1 ? (
        <SelectorBarbero
          parametro="barbero"
          opciones={barberos.map((b) => ({
            valor: b.id,
            etiqueta: b.id === userId ? "Vos" : (b.nombre.split(" ")[0] ?? b.nombre),
          }))}
          elegido={barbero.id}
        />
      ) : null}

      {servicios.length === 0 ? (
        <EstadoVacio
          icono={Scissors}
          titulo="Todavía no hay servicios"
          descripcion="Sin servicios, los clientes sacan turno sin elegir qué se hacen. Cargá por ejemplo Corte, Corte + barba o Barba, con su precio."
          accion={botonNuevo}
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {servicios.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl border border-hierro bg-ebano p-4",
                  !s.activo && "opacity-70",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words text-marfil">{s.nombre}</p>
                  <p className="numeros mt-0.5 font-titulo text-xl text-oro-claro">
                    {formatearPesos(s.precio)}
                  </p>
                  {s.descripcion ? (
                    <p className="mt-1.5 text-sm leading-relaxed break-words text-arena">
                      {s.descripcion}
                    </p>
                  ) : null}
                  {s.activo ? null : (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-[0.8125rem] text-arena">
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      Pausado: los clientes no lo ven
                    </p>
                  )}
                </div>
                <AccionesServicio servicio={s} />
              </li>
            ))}
          </ul>
          <p className="text-[0.8125rem] leading-relaxed text-arena">
            {activos === 0
              ? "Todos están pausados: los clientes sacan turno sin elegir servicio."
              : "Cambiar un precio no toca los turnos ya reservados. La duración del turno la marca el horario, no el servicio."}
          </p>
        </>
      )}
    </div>
  );
}
