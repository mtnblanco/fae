/**
 * Franjas horarias del editor de disponibilidad. La base valida lo mismo (y
 * genera los horarios con la misma regla); esto da feedback inmediato.
 */
import type { Duracion } from "./reglas";

export type Franja = { desde: string; hasta: string; duracion_min: Duracion };
export type FranjaSemanal = Franja & { dia_semana: number };

const aMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h! * 60 + m!;
};

const aHora = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/** Horas elegibles en el editor: de 06:00 a 24:00, cada 30 minutos. */
export function opcionesHora(desde = "06:00", hasta = "24:00"): string[] {
  const opciones: string[] = [];
  for (let m = aMinutos(desde); m <= aMinutos(hasta); m += 30) opciones.push(aHora(m));
  return opciones;
}

/**
 * Horarios de inicio de una franja: arrancan en "desde" y avanzan de a
 * `duracion_min`, solo los que entran enteros antes de "hasta".
 */
export function generarSlots(franja: Franja): string[] {
  const inicio = aMinutos(franja.desde);
  const fin = aMinutos(franja.hasta);
  const slots: string[] = [];
  for (let m = inicio; m + franja.duracion_min <= fin; m += franja.duracion_min) {
    slots.push(aHora(m));
  }
  return slots;
}

const esHoraValida = (hora: string) => /^([01]\d|2[0-3]):(00|30)$/.test(hora) || hora === "24:00";

/** Primer problema de una lista de franjas de un mismo día, o null si están bien. */
export function problemaFranjas(franjas: Franja[]): string | null {
  for (const f of franjas) {
    if (!esHoraValida(f.desde) || !esHoraValida(f.hasta)) {
      return "Las horas tienen que ser en punto o y media.";
    }
    if (aMinutos(f.hasta) <= aMinutos(f.desde)) {
      return `La franja de ${f.desde} termina antes de empezar.`;
    }
    if (generarSlots(f).length === 0) {
      return `En la franja de ${f.desde} a ${f.hasta} no entra un turno de ${f.duracion_min} min.`;
    }
  }
  const ordenadas = [...franjas].sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde));
  for (let i = 1; i < ordenadas.length; i++) {
    if (aMinutos(ordenadas[i]!.desde) < aMinutos(ordenadas[i - 1]!.hasta)) {
      return `Las franjas de ${ordenadas[i - 1]!.desde} y ${ordenadas[i]!.desde} se superponen.`;
    }
  }
  return null;
}

/** Franja nueva para un día: sigue a la última (si hay) o arranca a las 10. */
export function franjaSiguiente(franjas: Franja[]): Franja {
  const ultima = [...franjas].sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde)).at(-1);
  if (!ultima) return { desde: "10:00", hasta: "13:00", duracion_min: 30 };
  const desde = Math.min(aMinutos(ultima.hasta) + 4 * 60, 22 * 60);
  return {
    desde: aHora(desde),
    hasta: aHora(Math.min(desde + 4 * 60, 24 * 60)),
    duracion_min: ultima.duracion_min,
  };
}

/** "10:00:00" (como viene de Postgres) → "10:00". */
export const horaCorta = (hora: string) => hora.slice(0, 5);
