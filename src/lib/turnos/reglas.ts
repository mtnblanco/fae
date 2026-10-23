/**
 * Reglas de los turnos. Son las mismas que aplica la base (migración
 * 20261023000200_turnos.sql); acá sirven para armar la interfaz y los textos.
 */
export const TURNOS = {
  /** Anticipación mínima para reservar, en horas. */
  anticipacionHoras: 1,
  /** Días que se ofrecen: hoy y los 13 siguientes. */
  diasVentana: 14,
  /** El cliente puede cancelar desde la web hasta estas horas antes. */
  cancelarHastaHoras: 3,
  /** Duraciones posibles de un turno, por franja. */
  duraciones: [30, 60] as const,
} as const;

export type Duracion = (typeof TURNOS.duraciones)[number];

/** Días de la semana como los guarda la base (0 = domingo), en el orden en que se muestran. */
export const DIAS_SEMANA = [
  { dia: 1, nombre: "Lunes", corto: "Lun" },
  { dia: 2, nombre: "Martes", corto: "Mar" },
  { dia: 3, nombre: "Miércoles", corto: "Mié" },
  { dia: 4, nombre: "Jueves", corto: "Jue" },
  { dia: 5, nombre: "Viernes", corto: "Vie" },
  { dia: 6, nombre: "Sábado", corto: "Sáb" },
  { dia: 0, nombre: "Domingo", corto: "Dom" },
] as const;
