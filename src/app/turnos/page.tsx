import { ArrowLeft, CalendarX2, ChevronRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { AvatarBarbero } from "@/components/turnos/avatar-barbero";
import { TurnoCliente } from "@/components/turnos/turno-cliente";
import { Button } from "@/components/ui/button";
import { sitio } from "@/config/site";
import { requireCliente } from "@/lib/auth";
import { barberosConTurnos, miProximoTurno } from "@/lib/datos/turnos";
import { hoyISO } from "@/lib/fechas";
import { RUTAS, rutaTurnosBarbero } from "@/lib/rutas";
import { cuandoTurno } from "@/lib/turnos/fechas";

export default async function PaginaTurnos() {
  const { perfil } = await requireCliente();
  const [turno, barberos] = await Promise.all([miProximoTurno(), barberosConTurnos()]);
  const hoy = hoyISO();
  const nombre = perfil.nombre.split(" ")[0];

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link
        href={RUTAS.carnet}
        className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md text-sm text-arena transition-colors hover:text-marfil"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mi carnet
      </Link>

      {turno ? (
        <>
          <header>
            <h1 className="text-[2rem] leading-[1.1] text-marfil">Ya tenés turno, {nombre}</h1>
            <p className="mt-2 text-[0.9375rem] text-arena">
              Para sacar otro, primero cancelá este.
            </p>
          </header>
          <TurnoCliente turno={turno} cliente={perfil.nombre} />
        </>
      ) : (
        <>
          <header>
            <h1 className="text-[2rem] leading-[1.1] text-marfil">Sacá turno</h1>
            <p className="mt-2 text-[0.9375rem] text-arena">Elegí con quién te cortás.</p>
          </header>

          {barberos.length === 0 ? (
            <EstadoVacio
              icono={CalendarX2}
              titulo="Por ahora no hay turnos online"
              descripcion="Escribinos por WhatsApp y te damos un horario."
              accion={
                sitio.whatsapp ? (
                  <Button asChild variant="oro">
                    <a
                      href={`https://wa.me/${sitio.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle aria-hidden />
                      Escribir por WhatsApp
                    </a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3">
              {barberos.map((b) => {
                const contenido = (
                  <>
                    <AvatarBarbero nombre={b.nombre} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-titulo text-[1.375rem] leading-tight text-marfil">
                        {b.nombre}
                      </span>
                      {b.proximo_libre ? (
                        <span className="numeros mt-1 block text-sm text-oro">
                          Próximo libre: {cuandoTurno(b.proximo_libre, hoy)}
                        </span>
                      ) : (
                        <span className="mt-1 block text-sm text-arena">
                          Sin turnos disponibles por ahora
                        </span>
                      )}
                    </span>
                  </>
                );
                return (
                  <li key={b.id}>
                    {b.proximo_libre ? (
                      <Link
                        href={rutaTurnosBarbero(b.id)}
                        className="group flex min-h-[5.5rem] items-center gap-4 rounded-xl border border-hierro bg-ebano p-4 transition-colors hover:border-oro/60 active:bg-ebano-claro"
                      >
                        {contenido}
                        <ChevronRight
                          className="size-5 shrink-0 text-oro transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    ) : (
                      <div className="flex min-h-[5.5rem] items-center gap-4 rounded-xl border border-hierro p-4 opacity-60">
                        {contenido}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-sm leading-relaxed text-arena">
            Atendemos en {sitio.sedes[0] ?? sitio.ciudad}, {sitio.ciudad}. Podés cancelar desde la
            web hasta 3 horas antes.
          </p>
        </>
      )}
    </div>
  );
}
