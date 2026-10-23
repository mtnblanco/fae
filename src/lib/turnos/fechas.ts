import { ZONA_HORARIA } from "@/config/site";

/**
 * Fechas de los turnos. Los horarios se generan en la base y llegan como
 * timestamptz; acá solo se formatean y agrupan en hora argentina.
 * Las fechas "de calendario" viajan como "YYYY-MM-DD".
 */

const LOCALE = "es-AR";

const fmtHora = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZONA_HORARIA,
});
const fmtISO = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONA_HORARIA,
});
// Para fechas de calendario se usa UTC al mediodía: nunca se corre de día.
const fmtSemanaCorta = new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" });
const fmtSemanaLarga = new Intl.DateTimeFormat(LOCALE, { weekday: "long", timeZone: "UTC" });
const fmtMesCorto = new Intl.DateTimeFormat(LOCALE, { month: "short", timeZone: "UTC" });
const fmtMesLargo = new Intl.DateTimeFormat(LOCALE, { month: "long", timeZone: "UTC" });

const sinPunto = (s: string) => s.replace(/\./g, "");
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Convierte el timestamptz que devuelve la API a Date. Acepta el formato de
 * PostgREST ("2026-10-24T21:30:00+00:00") y el de Postgres en texto
 * ("2026-10-24 21:30:00+00"), que Safari no entiende tal cual.
 */
export function aInstante(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  let s = valor.trim().replace(" ", "T");
  if (/[+-]\d{2}$/.test(s)) s = `${s}:00`;
  return new Date(s);
}

/** "18:30" en hora argentina. */
export const horaTurno = (valor: string | Date) => fmtHora.format(aInstante(valor));

/** Fecha de calendario argentina ("YYYY-MM-DD") de un instante. */
export const fechaTurno = (valor: string | Date) => fmtISO.format(aInstante(valor));

const mediodia = (fecha: string) => {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!, 12));
};

/** "2026-10-24" + n días. */
export function sumarDias(fecha: string, dias: number): string {
  const d = mediodia(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana como en Postgres: 0 = domingo … 6 = sábado. */
export const diaDeLaSemana = (fecha: string) => mediodia(fecha).getUTCDay();

/** Los `cantidad` días desde `desde` (incluido). */
export function proximosDias(desde: string, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => sumarDias(desde, i));
}

/** Partes para la tira de días: { semana: "VIE", numero: "24", mes: "oct" }. */
export function partesDia(fecha: string) {
  const d = mediodia(fecha);
  return {
    semana: sinPunto(fmtSemanaCorta.format(d)).toUpperCase(),
    numero: String(d.getUTCDate()),
    mes: sinPunto(fmtMesCorto.format(d)),
    mesLargo: fmtMesLargo.format(d),
  };
}

/** "hoy", "mañana" o "el jueves" (para "probá el jueves"). */
export function nombreRelativo(fecha: string, hoy: string): string {
  if (fecha === hoy) return "hoy";
  if (fecha === sumarDias(hoy, 1)) return "mañana";
  return `el ${fmtSemanaLarga.format(mediodia(fecha))}`;
}

/** "Hoy", "Mañana" o "Vie 24 de oct". */
export function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  const { numero, mes } = partesDia(fecha);
  return `${mayuscula(sinPunto(fmtSemanaCorta.format(mediodia(fecha))))} ${numero} de ${mes}`;
}

/** "Viernes 24 de octubre" */
export function diaLargo(fecha: string): string {
  const d = mediodia(fecha);
  return `${mayuscula(fmtSemanaLarga.format(d))} ${d.getUTCDate()} de ${fmtMesLargo.format(d)}`;
}

/** "Hoy 18:30", "Mañana 10:00" o "Vie 24 de oct, 18:30". */
export function cuandoTurno(valor: string | Date, hoy: string): string {
  const fecha = fechaTurno(valor);
  const dia = etiquetaDia(fecha, hoy);
  return fecha === hoy || fecha === sumarDias(hoy, 1)
    ? `${dia} ${horaTurno(valor)}`
    : `${dia}, ${horaTurno(valor)}`;
}

export type MomentoDelDia = "Mañana" | "Tarde" | "Noche";

/** Para agrupar los horarios: antes de las 13 es mañana; desde las 19, noche. */
export function momentoDelDia(hora: string): MomentoDelDia {
  const h = Number(hora.slice(0, 2));
  if (h < 13) return "Mañana";
  if (h < 19) return "Tarde";
  return "Noche";
}

export type Horario = { inicio: string; fin: string };

/** Agrupa horarios por fecha argentina, para cada uno de los días pedidos. */
export function agruparPorDia<T extends Horario>(horarios: T[], dias: string[]) {
  const grupos = new Map<string, T[]>(dias.map((d) => [d, []]));
  for (const h of horarios) grupos.get(fechaTurno(h.inicio))?.push(h);
  return grupos;
}
