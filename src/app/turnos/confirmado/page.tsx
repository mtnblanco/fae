import { CalendarPlus, Check } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SEDE } from "@/components/turnos/turno-cliente";
import { Button } from "@/components/ui/button";
import { requireCliente } from "@/lib/auth";
import { miProximoTurno } from "@/lib/datos/turnos";
import { RUTAS } from "@/lib/rutas";
import { diaLargo, fechaTurno, horaTurno } from "@/lib/turnos/fechas";

export const metadata = { title: "Turno confirmado" };

export default async function PaginaTurnoConfirmado() {
  const { perfil } = await requireCliente();
  const turno = await miProximoTurno();
  if (!turno) redirect(RUTAS.turnos);
  const nombre = perfil.nombre.split(" ")[0];

  return (
    <div className="grid grid-cols-1 gap-6 pt-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-exito/50 bg-exito/10 text-exito">
        <Check className="size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-[2.25rem] leading-tight text-marfil">¡Listo, {nombre}!</h1>
        <p className="numeros mt-3 font-titulo text-[1.625rem] leading-tight text-oro-claro">
          {diaLargo(fechaTurno(turno.inicio))} · {horaTurno(turno.inicio)}
        </p>
        <p className="mt-2 text-[0.9375rem] text-arena">
          con <span className="text-marfil">{turno.barbero_nombre}</span> · {SEDE}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <Button asChild variant="oro" size="lg" className="h-14">
          <a href="/turnos/calendario" download>
            <CalendarPlus aria-hidden />
            Agregar a mi calendario
          </a>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-14">
          <Link href={RUTAS.carnet}>Ver mi carnet</Link>
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-arena">
        Podés cancelarlo desde tu carnet hasta 3 horas antes. Después, avisanos por WhatsApp.
      </p>
    </div>
  );
}
