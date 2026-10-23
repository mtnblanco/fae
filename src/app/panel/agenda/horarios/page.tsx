import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { DiasEspeciales } from "@/components/panel/agenda/dias-especiales";
import { EditorSemanal } from "@/components/panel/agenda/editor-semanal";
import { SelectorBarbero } from "@/components/panel/agenda/selector-barbero";
import { requireBarbero } from "@/lib/auth";
import { diasEspeciales, horarioSemanal, listarBarberos } from "@/lib/datos/turnos";
import { hoyISO } from "@/lib/fechas";
import { RUTAS } from "@/lib/rutas";

export const metadata: Metadata = { title: "Horarios" };

export default async function PaginaHorarios({
  searchParams,
}: PageProps<"/panel/agenda/horarios">) {
  const { userId, perfil } = await requireBarbero();
  const sp = await searchParams;

  // El empleado edita solo los suyos; el dueño, los de cualquiera (?barbero=).
  const barberos = perfil.es_dueno ? await listarBarberos() : [];
  const pedido = typeof sp.barbero === "string" ? sp.barbero : userId;
  const barbero = (perfil.es_dueno && barberos.find((b) => b.id === pedido)) || {
    id: userId,
    nombre: perfil.nombre,
  };
  const propio = barbero.id === userId;
  const hoy = hoyISO();

  const [semanal, especiales] = await Promise.all([
    horarioSemanal(barbero.id),
    diasEspeciales(barbero.id, hoy),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      <EncabezadoPagina
        className="mb-0 sm:mb-0"
        titulo={propio ? "Mis horarios" : `Horarios de ${barbero.nombre.split(" ")[0]}`}
        descripcion="Los turnos arrancan al inicio de cada franja. Cambiar el horario no toca los turnos ya reservados."
        volver={
          <Link
            href={RUTAS.agenda}
            className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-arena transition-colors hover:text-marfil"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Agenda
          </Link>
        }
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

      <section aria-labelledby="titulo-semana" className="grid grid-cols-1 gap-3">
        <h2 id="titulo-semana" className="text-2xl">
          Todas las semanas
        </h2>
        {/* key: al cambiar de barbero, el editor arranca de cero. */}
        <EditorSemanal key={barbero.id} barberoId={barbero.id} inicial={semanal} />
      </section>

      <section aria-labelledby="titulo-especiales" className="grid grid-cols-1 gap-3">
        <h2 id="titulo-especiales" className="text-2xl">
          Días especiales
        </h2>
        <DiasEspeciales barberoId={barbero.id} dias={especiales} semanal={semanal} hoy={hoy} />
      </section>
    </div>
  );
}
