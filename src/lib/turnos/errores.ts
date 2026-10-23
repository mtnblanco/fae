import { mensajeDeErrorDb } from "@/lib/errores";

/** Mensajes de los errores de las funciones SQL de turnos. */
const MENSAJES_TURNOS: Record<string, string> = {
  horario_ocupado: "Ese horario se acaba de ocupar. Elegí otro.",
  turno_activo: "Ya tenés un turno reservado. Para sacar otro, primero cancelá el que tenés.",
  turno_muy_pronto: "Los turnos se sacan con al menos 1 hora de anticipación. Elegí otro horario.",
  turno_fuera_de_ventana: "Por ahora se pueden sacar turnos hasta 14 días adelante.",
  horario_invalido: "Ese horario ya no está disponible. Elegí otro.",
  horario_pasado: "Ese horario ya pasó.",
  barbero_inexistente: "No encontramos a ese barbero.",
  turno_inexistente: "Ese turno ya no existe.",
  turno_atendido: "Ese turno ya fue atendido.",
  cancelacion_tardia:
    "Faltan menos de 3 horas para tu turno: avisanos por WhatsApp para cancelarlo.",
  franjas_superpuestas: "Hay franjas que se pisan en el mismo día. Revisalas.",
  franjas_invalidas: "Revisá los horarios: en cada franja tiene que entrar al menos un turno.",
  fecha_invalida: "Elegí una fecha de hoy en adelante.",
  datos_invalidos: "Revisá los datos e intentá de nuevo.",
  suscripcion_invalida: "Este navegador no permite activar las notificaciones.",
};

export function mensajeDeErrorTurno(error: { message?: string; code?: string } | null | undefined) {
  if (error?.message && MENSAJES_TURNOS[error.message]) return MENSAJES_TURNOS[error.message]!;
  return mensajeDeErrorDb(error);
}

/** Errores después de los cuales conviene volver a cargar los horarios. */
export const errorDeHorario = (error: { message?: string } | null | undefined) =>
  ["horario_ocupado", "horario_invalido", "turno_muy_pronto"].includes(error?.message ?? "");
