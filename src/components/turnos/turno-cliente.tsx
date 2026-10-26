import { CalendarClock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { sitio } from "@/config/site";
import type { MiTurno } from "@/lib/database.types";
import { hoyISO } from "@/lib/fechas";
import { RUTAS } from "@/lib/rutas";
import { etiquetaDia, fechaTurno, horaTurno } from "@/lib/turnos/fechas";
import { textoServicio } from "@/lib/turnos/servicios";
import { cn } from "@/lib/utils";
import { TarjetaMiTurno } from "./tarjeta-mi-turno";

export const SEDE = sitio.sedes[0] ?? sitio.ciudad;

/** "Vie 24 de oct · 18:30" (u "Hoy · 18:30"). */
export const cuandoCorto = (inicio: string) =>
  `${etiquetaDia(fechaTurno(inicio), hoyISO())} · ${horaTurno(inicio)}`;

/** Link de WhatsApp de la barbería con el mensaje armado. */
export function whatsappTurno(cliente: string, turno: Pick<MiTurno, "inicio" | "barbero_nombre">) {
  if (!sitio.whatsapp) return null;
  const nombre = cliente.split(" ")[0] ?? cliente;
  const barbero = turno.barbero_nombre.split(" ")[0] ?? turno.barbero_nombre;
  const texto = `Hola, soy ${nombre}. Tengo turno ${cuandoCorto(turno.inicio).replace(" · ", " a las ")} con ${barbero} y necesito cancelarlo.`;
  return `https://wa.me/${sitio.whatsapp}?text=${encodeURIComponent(texto)}`;
}

/** Tarjeta del turno del cliente (o el acceso para sacar uno). Va en el carnet. */
export function TurnoCliente({
  turno,
  cliente,
  className,
}: {
  turno: MiTurno | null;
  cliente: string;
  className?: string;
}) {
  if (turno) {
    return (
      <TarjetaMiTurno
        turnoId={turno.id}
        cuando={cuandoCorto(turno.inicio)}
        barbero={turno.barbero_nombre}
        servicio={textoServicio(turno.servicio_nombre, turno.servicio_precio)}
        sede={SEDE}
        puedeCancelar={turno.puede_cancelar}
        whatsapp={whatsappTurno(cliente, turno)}
        className={className}
      />
    );
  }
  return (
    <Link
      href={RUTAS.turnos}
      className={cn(
        "group flex min-h-[4.5rem] items-center gap-4 rounded-xl border border-hierro bg-ebano p-4 transition-colors hover:border-oro/60 active:bg-ebano-claro",
        className,
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ebano-claro text-oro">
        <CalendarClock className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-titulo text-xl text-marfil">Sacá turno</span>
        <span className="block text-sm text-arena">Elegí barbero, día y horario.</span>
      </span>
      <ChevronRight
        className="size-5 text-oro transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
