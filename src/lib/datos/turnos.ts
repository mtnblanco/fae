import "server-only";
import type { BarberoTurnos, FilaAgenda, MiTurno } from "@/lib/database.types";
import { horaCorta, type Franja, type FranjaSemanal } from "@/lib/turnos/franjas";
import { createClient } from "@/lib/supabase/server";

/** Todas las consultas usan la sesión del usuario: la base decide qué puede ver. */

function fallar(error: { message: string } | null, contexto: string) {
  if (error) throw new Error(`${contexto}: ${error.message}`);
}

/** Barberos que dan turnos, con su próximo horario libre. */
export async function barberosConTurnos(): Promise<BarberoTurnos[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("barberos_turnos");
  fallar(error, "No se pudieron cargar los barberos");
  return data ?? [];
}

/** Horarios libres de un barbero (14 días, desde 1 h en adelante). */
export async function horariosLibres(barberoId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("horarios_libres", { p_barbero: barberoId });
  fallar(error, "No se pudieron cargar los horarios");
  return data ?? [];
}

/** Próximo turno del cliente logueado, o null. */
export async function miProximoTurno(): Promise<MiTurno | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mi_proximo_turno");
  fallar(error, "No se pudo cargar tu turno");
  return data?.[0] ?? null;
}

/**
 * Barberos que atienden (para el selector del dueño y del admin): el dueño y
 * el empleado. El admin no atiende: no tiene agenda ni horarios.
 */
export async function listarBarberos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, es_dueno")
    .eq("rol", "barbero")
    .eq("es_admin", false)
    .order("es_dueno", { ascending: false })
    .order("nombre");
  fallar(error, "No se pudieron cargar los barberos");
  return data ?? [];
}

export async function agendaDelDia(barberoId: string, fecha: string): Promise<FilaAgenda[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("agenda_dia", {
    p_barbero: barberoId,
    p_fecha: fecha,
  });
  fallar(error, "No se pudo cargar la agenda");
  return data ?? [];
}

/** Días (de los próximos) que tienen turnos reservados, para marcarlos en la tira. */
export async function diasConTurnos(barberoIds: string[], desdeISO: string, hastaISO: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turnos")
    .select("inicio")
    .in("barbero_id", barberoIds)
    .eq("tipo", "reserva")
    .neq("estado", "cancelado")
    .gte("inicio", desdeISO)
    .lt("inicio", hastaISO);
  fallar(error, "No se pudo cargar la agenda");
  return (data ?? []).map((t) => t.inicio);
}

/** Horario semanal de un barbero, como lo usa el editor. */
export async function horarioSemanal(barberoId: string): Promise<FranjaSemanal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("horarios_semanales")
    .select("dia_semana, desde, hasta, duracion_min")
    .eq("barbero_id", barberoId)
    .order("dia_semana")
    .order("desde");
  fallar(error, "No se pudo cargar el horario");
  return (data ?? []).map((h) => ({
    dia_semana: h.dia_semana,
    desde: horaCorta(h.desde),
    hasta: horaCorta(h.hasta),
    duracion_min: h.duracion_min as Franja["duracion_min"],
  }));
}

export type DiaEspecialAgrupado = {
  fecha: string;
  cerrado: boolean;
  motivo: string | null;
  franjas: Franja[];
};

/** Días especiales de hoy en adelante, agrupados por fecha. */
export async function diasEspeciales(barberoId: string, desde: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dias_especiales")
    .select("fecha, cerrado, desde, hasta, duracion_min, motivo")
    .eq("barbero_id", barberoId)
    .gte("fecha", desde)
    .order("fecha")
    .order("desde");
  fallar(error, "No se pudieron cargar los días especiales");

  const porFecha = new Map<string, DiaEspecialAgrupado>();
  for (const d of data ?? []) {
    const fecha = d.fecha.slice(0, 10);
    const dia = porFecha.get(fecha) ?? { fecha, cerrado: d.cerrado, motivo: d.motivo, franjas: [] };
    if (!d.cerrado && d.desde && d.hasta && d.duracion_min) {
      dia.franjas.push({
        desde: horaCorta(d.desde),
        hasta: horaCorta(d.hasta),
        duracion_min: d.duracion_min as Franja["duracion_min"],
      });
    }
    porFecha.set(fecha, dia);
  }
  return [...porFecha.values()];
}
