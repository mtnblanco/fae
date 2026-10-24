"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireCliente } from "@/lib/auth";
import { hoyISO } from "@/lib/fechas";
import { avisarBarbero } from "@/lib/push/servidor";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { mensajeDeErrorTurno } from "@/lib/turnos/errores";
import { cuandoTurno, fechaTurno } from "@/lib/turnos/fechas";

const reservaSchema = z.object({
  barberoId: z.uuid(),
  inicio: z.string().min(10).max(40),
  solicitudId: z.uuid(),
});

/** Si falla porque el horario se ocupó, la pantalla vuelve a cargar los horarios. */
export type ResultadoReserva =
  { ok: true; id: string } | { ok: false; error: string; recargar: boolean };

function revalidarTurnos() {
  revalidatePath(RUTAS.turnos, "layout");
  revalidatePath(RUTAS.carnet);
}

const nombreCorto = (nombre: string) => nombre.split(" ")[0] ?? nombre;

/** El cliente reserva un horario libre. */
export async function reservarTurno(datos: {
  barberoId: string;
  inicio: string;
  solicitudId: string;
}): Promise<ResultadoReserva> {
  const { perfil } = await requireCliente();
  const parse = reservaSchema.safeParse(datos);
  if (!parse.success) return { ok: false, error: "Elegí un horario.", recargar: false };
  const { barberoId, inicio, solicitudId } = parse.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservar_turno", {
    p_barbero: barberoId,
    p_inicio: inicio,
    p_solicitud_id: solicitudId,
  });
  if (error || !data) {
    const recargar = ["horario_ocupado", "horario_invalido", "turno_muy_pronto"].includes(
      error?.message ?? "",
    );
    return { ok: false, error: mensajeDeErrorTurno(error), recargar };
  }

  after(() =>
    avisarBarbero(data.barbero_id, {
      titulo: "Nuevo turno",
      cuerpo: `${cuandoTurno(data.inicio, hoyISO())} · ${perfil.nombre}`,
      url: `${RUTAS.agenda}?fecha=${fechaTurno(data.inicio)}`,
      // Por cliente: si reserva y cancela varias veces, los avisos se reemplazan.
      tag: `cliente-${perfil.id}`,
    }),
  );
  revalidarTurnos();
  return { ok: true, id: data.id };
}

/** El cliente cancela su turno (hasta 6 horas antes). */
export async function cancelarMiTurno(turnoId: string): Promise<Resultado> {
  const { perfil } = await requireCliente();
  if (!z.uuid().safeParse(turnoId).success) return fallo("Ese turno ya no existe.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancelar_turno", { p_turno_id: turnoId });
  if (error || !data) return fallo(mensajeDeErrorTurno(error));

  after(() =>
    avisarBarbero(data.barbero_id, {
      titulo: "Turno cancelado",
      cuerpo: `${nombreCorto(perfil.nombre)} canceló su turno de ${cuandoTurno(data.inicio, hoyISO()).toLowerCase()}`,
      url: `${RUTAS.agenda}?fecha=${fechaTurno(data.inicio)}`,
      // Por cliente: si reserva y cancela varias veces, los avisos se reemplazan.
      tag: `cliente-${perfil.id}`,
    }),
  );
  revalidarTurnos();
  return exito(undefined);
}
