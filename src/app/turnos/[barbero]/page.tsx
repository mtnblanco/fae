import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AvatarBarbero } from "@/components/turnos/avatar-barbero";
import { SelectorHorario, type HorarioLibre } from "@/components/turnos/selector-horario";
import { SEDE } from "@/components/turnos/turno-cliente";
import { sitio } from "@/config/site";
import { requireCliente } from "@/lib/auth";
import { barberosConTurnos, horariosLibres, miProximoTurno } from "@/lib/datos/turnos";
import { hoyISO } from "@/lib/fechas";
import { RUTAS } from "@/lib/rutas";
import { aInstante, fechaTurno, horaTurno, proximosDias } from "@/lib/turnos/fechas";
import { TURNOS } from "@/lib/turnos/reglas";

export default async function PaginaTurnoConBarbero({ params }: PageProps<"/turnos/[barbero]">) {
  const { barbero: id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await requireCliente();

  const [turno, barberos, libres] = await Promise.all([
    miProximoTurno(),
    barberosConTurnos(),
    horariosLibres(id),
  ]);
  if (turno) redirect(RUTAS.turnos);
  const barbero = barberos.find((b) => b.id === id);
  if (!barbero) notFound();

  const hoy = hoyISO();
  const horarios: HorarioLibre[] = libres.map((h) => ({
    inicio: h.inicio,
    fecha: fechaTurno(h.inicio),
    hora: horaTurno(h.inicio),
    duracion: Math.round((aInstante(h.fin).getTime() - aInstante(h.inicio).getTime()) / 60_000),
  }));
  const nombre = barbero.nombre.split(" ")[0] ?? barbero.nombre;

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={RUTAS.turnos}
            className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm text-arena transition-colors hover:text-marfil"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Barberos
          </Link>
          <h1 className="truncate text-[2rem] leading-[1.1] text-marfil">Turno con {nombre}</h1>
        </div>
        <AvatarBarbero nombre={barbero.nombre} />
      </div>

      <SelectorHorario
        barberoId={barbero.id}
        barberoNombre={nombre}
        hoy={hoy}
        dias={proximosDias(hoy, TURNOS.diasVentana)}
        horarios={horarios}
        sede={SEDE}
        whatsapp={sitio.whatsapp ? `https://wa.me/${sitio.whatsapp}` : null}
      />
    </div>
  );
}
