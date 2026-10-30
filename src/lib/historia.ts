/**
 * Imagen para historia de Instagram con los turnos libres de un barbero en un
 * día: textos y distribución según cuántos horarios hay. La dibuja
 * /panel/agenda/historia (next/og).
 */
import { diaLargo, sumarDias } from "@/lib/turnos/fechas";

/** Tamaño de una historia de Instagram. */
export const HISTORIA = { ancho: 1080, alto: 1920 } as const;

/** Hasta esta cantidad, "Últimos turnos" con pastillas grandes, una debajo de otra. */
export const POCOS = 3;
/** Más que esto no entra legible: se muestran los primeros y "y N más". */
export const MAXIMO = 28;

export type Distribucion =
  | { tipo: "pocos"; alto: number; letra: number }
  | { tipo: "grilla"; columnas: number; alto: number; letra: number; hueco: number };

/**
 * Cómo se acomodan `n` horarios (n ≥ 1) en `disponible` px de alto: las
 * pastillas se achican (hasta un mínimo legible) para que entren todas.
 */
export function distribucion(n: number, disponible: number): Distribucion {
  if (n <= POCOS) return { tipo: "pocos", alto: 140, letra: 72 };
  const base =
    n <= 12
      ? { columnas: 3, alto: 128, letra: 60, hueco: 26 }
      : n <= 20
        ? { columnas: 4, alto: 112, letra: 50, hueco: 22 }
        : { columnas: 4, alto: 92, letra: 42, hueco: 18 };
  const filas = Math.ceil(Math.min(n, MAXIMO) / base.columnas);
  const entra = Math.floor((disponible - (filas - 1) * base.hueco) / filas);
  const alto = Math.max(64, Math.min(base.alto, entra));
  return {
    tipo: "grilla",
    columnas: base.columnas,
    alto,
    letra: Math.round((base.letra * alto) / base.alto),
    hueco: base.hueco,
  };
}

/** Los horarios que se dibujan y cuántos quedaron afuera. */
export function recortar(horarios: string[]): { visibles: string[]; resto: number } {
  if (horarios.length <= MAXIMO) return { visibles: horarios, resto: 0 };
  // Uno menos, para que "y N más" ocupe su lugar en la grilla.
  const visibles = horarios.slice(0, MAXIMO - 1);
  return { visibles, resto: horarios.length - visibles.length };
}

/**
 * Textos de la historia. El título lleva una palabra encendida (`luz`):
 * "Turnos hoy", "Turnos mañana", "Turnos disponibles"; con pocos, "Últimos turnos".
 */
export function textosHistoria(fecha: string, hoy: string, cantidad: number, barbero: string) {
  const relativo = fecha === hoy ? "hoy" : fecha === sumarDias(hoy, 1) ? "mañana" : null;
  const titulo =
    cantidad <= POCOS
      ? { antes: "Últimos", luz: "turnos" }
      : { antes: "Turnos", luz: relativo ?? "disponibles" };
  return {
    dia: diaLargo(fecha),
    titulo,
    /** Solo "Turnos hoy" entra en una línea; los demás van en dos. */
    dosLineas: titulo.luz !== "hoy",
    barbero: barbero.split(" ")[0] ?? barbero,
  };
}

/** "turnos-martin-2026-10-30.png" */
export function nombreArchivoHistoria(barbero: string, fecha: string): string {
  const nombre = (barbero.split(" ")[0] ?? "barbero")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `turnos-${nombre || "barbero"}-${fecha}.png`;
}
