import { ZONA_HORARIA } from "@/config/site";

const LOCALE = "es-AR";

const fmtFecha = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});
const fmtFechaCorta = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});
const fmtFechaHora = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZONA_HORARIA,
});
const fmtMes = new Intl.DateTimeFormat(LOCALE, { month: "long", timeZone: ZONA_HORARIA });
const fmtAnio = new Intl.DateTimeFormat(LOCALE, { year: "numeric", timeZone: ZONA_HORARIA });
const fmtISO = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONA_HORARIA,
});
const relativo = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

const aFecha = (valor: string | Date) => (valor instanceof Date ? valor : new Date(valor));

/** "12 de octubre de 2026" */
export const formatearFecha = (valor: string | Date) => fmtFecha.format(aFecha(valor));

/** "12 de oct de 2026" */
export const formatearFechaCorta = (valor: string | Date) =>
  fmtFechaCorta.format(aFecha(valor)).replace(/\./g, "");

/** "12 oct, 18:30" */
export const formatearFechaHora = (valor: string | Date) =>
  fmtFechaHora.format(aFecha(valor)).replace(/\./g, "");

/** "octubre" */
export const nombreDelMes = (valor: string | Date = new Date()) => fmtMes.format(aFecha(valor));

/** "2026" */
export const anioDe = (valor: string | Date) => fmtAnio.format(aFecha(valor));

/** Fecha de hoy en Argentina como "YYYY-MM-DD" (para inputs de tipo date). */
export const hoyISO = (ahora: Date = new Date()) => fmtISO.format(ahora);

/** Fecha "YYYY-MM-DD" (sin hora) a "12 de oct de 2026", sin corrimientos de zona horaria. */
export function formatearDia(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return formatearFechaCorta(new Date(Date.UTC(anio!, mes! - 1, dia!, 12)));
}

/** "hace 5 minutos", "ayer", "hace 3 días"… */
export function tiempoRelativo(valor: string | Date, ahora: Date = new Date()): string {
  const segundos = Math.round((aFecha(valor).getTime() - ahora.getTime()) / 1000);
  const abs = Math.abs(segundos);
  if (abs < 45) return "recién";
  if (abs < 3600) return relativo.format(Math.round(segundos / 60), "minute");
  if (abs < 86_400) return relativo.format(Math.round(segundos / 3600), "hour");
  if (abs < 86_400 * 30) return relativo.format(Math.round(segundos / 86_400), "day");
  if (abs < 86_400 * 365) return relativo.format(Math.round(segundos / (86_400 * 30)), "month");
  return relativo.format(Math.round(segundos / (86_400 * 365)), "year");
}

/**
 * Fin del día (medianoche siguiente, hora de Argentina) del momento dado, en
 * ms. Argentina no tiene horario de verano: el día empieza a las 03:00 UTC.
 */
export function finDelDia(valor: string | Date): number {
  const [anio, mes, dia] = hoyISO(aFecha(valor)).split("-").map(Number);
  return Date.UTC(anio!, mes! - 1, dia! + 1, 3);
}
