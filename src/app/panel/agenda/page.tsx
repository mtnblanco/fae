import { CalendarDays, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { ActivarNotificaciones } from "@/components/panel/activar-notificaciones";
import { ActualizadorAgenda } from "@/components/panel/agenda/actualizador-agenda";
import { DiasAgenda } from "@/components/panel/agenda/dias-agenda";
import { type FilaVista, ListaAgenda } from "@/components/panel/agenda/lista-agenda";
import { SelectorBarbero } from "@/components/panel/agenda/selector-barbero";
import { Button } from "@/components/ui/button";
import { requireBarbero } from "@/lib/auth";
import { agendaDelDia, diasConTurnos, listarBarberos } from "@/lib/datos/turnos";
import { hoyISO } from "@/lib/fechas";
import { RUTAS } from "@/lib/rutas";
import {
  aInstante,
  etiquetaDia,
  fechaTurno,
  horaTurno,
  proximosDias,
  sumarDias,
} from "@/lib/turnos/fechas";
import { TURNOS } from "@/lib/turnos/reglas";

export const metadata: Metadata = { title: "Agenda" };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** "de hoy", "de mañana", "del jue 29 de oct" (para los mensajes de WhatsApp). */
function fraseDia(fecha: string, hoy: string) {
  const etiqueta = etiquetaDia(fecha, hoy);
  if (etiqueta === "Hoy" || etiqueta === "Mañana") return `de ${etiqueta.toLowerCase()}`;
  return `del ${etiqueta.toLowerCase()}`;
}

export default async function PaginaAgenda({ searchParams }: PageProps<"/panel/agenda">) {
  const { userId, perfil } = await requireBarbero();
  const sp = await searchParams;
  const hoy = hoyISO();
  const pedida = typeof sp.fecha === "string" && FECHA.test(sp.fecha) ? sp.fecha : hoy;
  // La tira muestra desde hoy (o desde el día pedido, si es anterior: viene de un aviso viejo).
  const desde = pedida < hoy ? pedida : hoy;
  const dias = proximosDias(desde, Math.max(TURNOS.diasVentana, 1));
  if (!dias.includes(pedida)) dias.push(pedida);

  // El empleado ve solo su agenda; el dueño elige: él, el empleado o ambos.
  // El admin no atiende (no tiene agenda): elige entre los barberos y arranca
  // viendo la de todos.
  const esAdmin = perfil.es_admin;
  const barberos = perfil.es_dueno
    ? await listarBarberos()
    : [{ id: userId, nombre: perfil.nombre, es_dueno: false }];
  const ver = typeof sp.ver === "string" ? sp.ver : esAdmin ? "ambos" : userId;
  const elegidos =
    perfil.es_dueno && ver === "ambos"
      ? barberos
      : barberos.filter((b) => b.id === (perfil.es_dueno ? ver : userId));
  const mostrados =
    elegidos.length > 0 ? elegidos : esAdmin ? barberos : barberos.filter((b) => b.id === userId);
  const ambos = mostrados.length > 1;

  if (mostrados.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-5">
        <EncabezadoPagina className="mb-0 sm:mb-0" titulo="Agenda" />
        <EstadoVacio
          icono={CalendarDays}
          titulo="Todavía no hay barberos"
          descripcion="Cuando haya un barbero cargado, vas a ver su agenda acá."
        />
      </div>
    );
  }

  const [agendas, conTurnos] = await Promise.all([
    Promise.all(mostrados.map((b) => agendaDelDia(b.id, pedida))),
    diasConTurnos(
      mostrados.map((b) => b.id),
      aInstante(`${dias[0]}T00:00:00-03:00`).toISOString(),
      aInstante(`${sumarDias(dias.at(-1)!, 1)}T00:00:00-03:00`).toISOString(),
    ),
  ]);

  const filas: FilaVista[] = agendas
    .flatMap((agenda, i) =>
      agenda.map((f) => ({
        clave: `${mostrados[i]!.id}-${f.turno_id ?? f.inicio}`,
        tipo: f.tipo,
        inicio: f.inicio,
        fin: f.fin,
        hora: horaTurno(f.inicio),
        horaFin: horaTurno(f.fin),
        turnoId: f.turno_id,
        estado: f.estado,
        clienteId: f.cliente_id,
        clienteNombre: f.cliente_nombre,
        clienteTelefono: f.cliente_telefono,
        nota: f.nota,
        barberoId: mostrados[i]!.id,
        barberoNombre: ambos ? mostrados[i]!.nombre : null,
      })),
    )
    .sort((a, b) => aInstante(a.inicio).getTime() - aInstante(b.inicio).getTime());

  const reservas = filas.filter((f) => f.tipo === "reserva").length;
  const libres = filas.filter((f) => f.tipo === "libre").length;
  const unico = mostrados.length === 1 ? mostrados[0]! : null;
  const linkHorarios =
    unico && unico.id !== userId ? `${RUTAS.horarios}?barbero=${unico.id}` : RUTAS.horarios;

  return (
    <div className="grid grid-cols-1 gap-5">
      <ActualizadorAgenda barberoIds={mostrados.map((b) => b.id)} />
      <EncabezadoPagina
        className="mb-0 sm:mb-0"
        titulo="Agenda"
        acciones={
          <Button asChild variant="outline" size="sm" className="h-10">
            <Link href={linkHorarios}>
              <Clock aria-hidden />
              Horarios
            </Link>
          </Button>
        }
      />

      {/* El admin no tiene turnos: no recibe avisos. */}
      {esAdmin ? null : <ActivarNotificaciones />}

      {perfil.es_dueno && barberos.length > 1 ? (
        <SelectorBarbero
          opciones={[
            ...barberos.map((b) => ({
              valor: b.id,
              etiqueta: b.id === userId ? "Vos" : (b.nombre.split(" ")[0] ?? b.nombre),
            })),
            { valor: "ambos", etiqueta: barberos.length === 2 ? "Ambos" : "Todos" },
          ]}
          elegido={ambos ? "ambos" : (unico?.id ?? userId)}
        />
      ) : null}

      <DiasAgenda
        dias={dias}
        elegido={pedida}
        hoy={hoy}
        conTurnos={[...new Set(conTurnos.map((t) => fechaTurno(t)))]}
      />

      <p className="numeros text-sm text-arena" aria-live="polite">
        <span className="text-marfil">{etiquetaDia(pedida, hoy)}</span>
        {filas.length > 0
          ? ` · ${reservas === 1 ? "1 turno" : `${reservas} turnos`} · ${libres === 1 ? "1 libre" : `${libres} libres`}`
          : ""}
      </p>

      {filas.length === 0 ? (
        <EstadoVacio
          icono={CalendarDays}
          titulo={pedida < hoy ? "Sin turnos ese día" : "Sin horarios este día"}
          descripcion={
            pedida < hoy
              ? "Ese día ya pasó."
              : "No hay franjas cargadas para este día, o ya pasaron todas."
          }
          accion={
            pedida >= hoy ? (
              <Button asChild variant="oro">
                <Link href={linkHorarios}>Cargar horarios</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ListaAgenda filas={filas} dia={fraseDia(pedida, hoy)} />
      )}
    </div>
  );
}
