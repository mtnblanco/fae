"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireBarbero } from "@/lib/auth";
import { normalizarBusqueda } from "@/lib/busqueda";
import { hoyISO } from "@/lib/fechas";
import { endpointPushValido, ENDPOINT_PUSH_MAX } from "@/lib/push/endpoints";
import { avisarBarbero } from "@/lib/push/servidor";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { mensajeDeErrorTurno } from "@/lib/turnos/errores";
import { cuandoTurno, fechaTurno } from "@/lib/turnos/fechas";
import { type Franja, problemaFranjas } from "@/lib/turnos/franjas";

const uuid = z.uuid();
const instante = z.string().min(10).max(40);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hora = z.string().regex(/^([01]\d|2[0-4]):(00|30)$/);
const franjaSchema = z.object({
  desde: hora,
  hasta: hora,
  duracion_min: z.union([z.literal(30), z.literal(60)]),
});
const franjaSemanalSchema = franjaSchema.extend({ dia_semana: z.number().int().min(0).max(6) });

function revalidarAgenda() {
  revalidatePath(RUTAS.agenda, "layout");
}

const linkAgenda = (inicio: string) => `${RUTAS.agenda}?fecha=${fechaTurno(inicio)}`;
/** Los avisos de un mismo cliente se reemplazan en vez de apilarse. */
const tagCliente = (clienteId: string) => `cliente-${clienteId}`;

// ─── Turnos de la agenda ────────────────────────────────────────────────────

/** Cancela un turno o quita un bloqueo. Si el turno era de otro barbero, le avisa. */
export async function cancelarTurnoAgenda(turnoId: string): Promise<Resultado> {
  const { userId } = await requireBarbero();
  if (!uuid.safeParse(turnoId).success) return fallo("Ese turno ya no existe.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancelar_turno", { p_turno_id: turnoId });
  if (error || !data) return fallo(mensajeDeErrorTurno(error));

  if (data.tipo === "reserva" && data.barbero_id !== userId) {
    after(() =>
      avisarBarbero(data.barbero_id, {
        titulo: "Turno cancelado",
        cuerpo: `Se canceló el turno de ${cuandoTurno(data.inicio, hoyISO()).toLowerCase()}`,
        url: linkAgenda(data.inicio),
        tag: tagCliente(data.cliente_id ?? data.id),
      }),
    );
  }
  revalidarAgenda();
  return exito(undefined);
}

/** El barbero le reserva un horario a un cliente (pedido por teléfono o en persona). */
export async function reservarParaCliente(datos: {
  barberoId: string;
  clienteId: string;
  /** Ya no se usa: el nombre del aviso sale de la base (no del navegador). */
  clienteNombre?: string;
  inicio: string;
  solicitudId: string;
}): Promise<Resultado> {
  const { userId } = await requireBarbero();
  const parse = z
    .object({
      barberoId: uuid,
      clienteId: uuid,
      inicio: instante,
      solicitudId: uuid,
    })
    .safeParse(datos);
  if (!parse.success) return fallo("Elegí un cliente.");
  const d = parse.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservar_para_cliente", {
    p_barbero: d.barberoId,
    p_cliente_id: d.clienteId,
    p_inicio: d.inicio,
    p_solicitud_id: d.solicitudId,
  });
  if (error || !data) return fallo(mensajeDeErrorTurno(error));

  if (data.barbero_id !== userId) {
    after(async () => {
      // El nombre, de la base (con la sesión del barbero): no del navegador.
      const { data: cliente } = await supabase
        .from("perfiles")
        .select("nombre")
        .eq("id", d.clienteId)
        .maybeSingle();
      await avisarBarbero(data.barbero_id, {
        titulo: "Nuevo turno",
        cuerpo: `${cuandoTurno(data.inicio, hoyISO())}${cliente?.nombre ? ` · ${cliente.nombre}` : ""}`,
        url: linkAgenda(data.inicio),
        tag: tagCliente(d.clienteId),
      });
    });
  }
  revalidarAgenda();
  return exito(undefined);
}

export async function bloquearHorario(datos: {
  barberoId: string;
  inicio: string;
  fin: string;
  nota: string;
  solicitudId: string;
}): Promise<Resultado> {
  await requireBarbero();
  const parse = z
    .object({
      barberoId: uuid,
      inicio: instante,
      fin: instante,
      nota: z.string().trim().max(120),
      solicitudId: uuid,
    })
    .safeParse(datos);
  if (!parse.success) return fallo("El motivo puede tener hasta 120 letras.");
  const d = parse.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("bloquear_horario", {
    p_barbero: d.barberoId,
    p_inicio: d.inicio,
    p_fin: d.fin,
    p_nota: d.nota || null,
    p_solicitud_id: d.solicitudId,
  });
  if (error) return fallo(mensajeDeErrorTurno(error));
  revalidarAgenda();
  return exito(undefined);
}

export type ClienteEncontrado = { id: string; nombre: string; telefono: string };

/** Buscador de clientes para "Reservar para un cliente". */
export async function buscarClientesParaTurno(texto: string): Promise<ClienteEncontrado[]> {
  await requireBarbero();
  const termino = normalizarBusqueda(texto.slice(0, 80));
  if (!termino) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("perfiles")
    .select("id, nombre, telefono")
    .eq("rol", "cliente")
    .ilike("busqueda", `*${termino}*`)
    .order("nombre")
    .limit(8);
  return (data ?? []).map((c) => ({ id: c.id, nombre: c.nombre, telefono: c.telefono ?? "" }));
}

// ─── Horarios ───────────────────────────────────────────────────────────────

export async function guardarHorarioSemanal(
  barberoId: string,
  franjas: (Franja & { dia_semana: number })[],
): Promise<Resultado> {
  await requireBarbero();
  const parse = z
    .object({ barberoId: uuid, franjas: z.array(franjaSemanalSchema).max(100) })
    .safeParse({ barberoId, franjas });
  if (!parse.success) return fallo("Revisá los horarios.");

  for (let dia = 0; dia <= 6; dia++) {
    const problema = problemaFranjas(parse.data.franjas.filter((f) => f.dia_semana === dia));
    if (problema) return fallo(problema);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_horario_semanal", {
    p_barbero: parse.data.barberoId,
    p_franjas: parse.data.franjas,
  });
  if (error) return fallo(mensajeDeErrorTurno(error));
  revalidarAgenda();
  return exito(undefined);
}

export async function guardarDiaEspecial(datos: {
  barberoId: string;
  fecha: string;
  franjas: Franja[];
  motivo: string;
}): Promise<Resultado> {
  await requireBarbero();
  const parse = z
    .object({
      barberoId: uuid,
      fecha,
      franjas: z.array(franjaSchema).max(20),
      motivo: z.string().trim().max(60),
    })
    .safeParse(datos);
  if (!parse.success) {
    const motivoLargo = parse.error.issues.some((i) => i.path[0] === "motivo");
    return fallo(
      motivoLargo ? "El motivo puede tener hasta 60 letras." : "Revisá la fecha y los horarios.",
    );
  }
  const problema = problemaFranjas(parse.data.franjas);
  if (problema) return fallo(problema);

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_dia_especial", {
    p_barbero: parse.data.barberoId,
    p_fecha: parse.data.fecha,
    p_franjas: parse.data.franjas,
    p_motivo: parse.data.motivo || null,
  });
  if (error) return fallo(mensajeDeErrorTurno(error));
  revalidarAgenda();
  return exito(undefined);
}

export async function borrarDiaEspecial(barberoId: string, dia: string): Promise<Resultado> {
  await requireBarbero();
  if (!uuid.safeParse(barberoId).success || !fecha.safeParse(dia).success) {
    return fallo("Ese día especial ya no existe.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("borrar_dia_especial", {
    p_barbero: barberoId,
    p_fecha: dia,
  });
  if (error) return fallo(mensajeDeErrorTurno(error));
  revalidarAgenda();
  return exito(undefined);
}

// ─── Notificaciones ─────────────────────────────────────────────────────────

const suscripcionSchema = z.object({
  // Solo servicios push reales (FCM, Mozilla, Apple, Windows): nada de SSRF.
  endpoint: z.string().max(ENDPOINT_PUSH_MAX).refine(endpointPushValido),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

/** Guarda (o actualiza) la suscripción push de este dispositivo para el barbero. */
export async function guardarSuscripcionPush(suscripcion: unknown): Promise<Resultado> {
  const { perfil } = await requireBarbero();
  // El admin no tiene turnos: no recibe avisos (la base también lo rechaza).
  if (perfil.es_admin) return fallo("El admin no recibe notificaciones de turnos.");
  const parse = suscripcionSchema.safeParse(suscripcion);
  if (!parse.success) return fallo("Este navegador no permite activar las notificaciones.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_suscripcion_push", {
    p_endpoint: parse.data.endpoint,
    p_p256dh: parse.data.keys.p256dh,
    p_auth: parse.data.keys.auth,
  });
  if (error) return fallo(mensajeDeErrorTurno(error));
  return exito(undefined);
}

export async function borrarSuscripcionPush(endpoint: string): Promise<Resultado> {
  await requireBarbero();
  if (typeof endpoint !== "string" || endpoint.length > ENDPOINT_PUSH_MAX) return exito(undefined);
  const supabase = await createClient();
  const { error } = await supabase.rpc("borrar_suscripcion_push", { p_endpoint: endpoint });
  if (error) return fallo(mensajeDeErrorTurno(error));
  return exito(undefined);
}
