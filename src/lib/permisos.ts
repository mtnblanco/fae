import { finDelDia } from "@/lib/fechas";
import { RUTAS } from "@/lib/rutas";

/**
 * Qué puede hacer cada barbero. Es la misma regla que aplica la base (RLS y
 * funciones SQL); acá sirve para el proxy, los guards y para no mostrar botones
 * que el empleado no puede usar.
 *
 *  · Dueño: todo. Deshace cualquier corte del día (por si se equivocó).
 *  · Admin (es_dueno + es_admin): todo lo del dueño, pero no atiende: no tiene
 *    horarios, turnos ni agenda propia, y no se ofrece a los clientes.
 *  · Empleado: buscar, escanear, dar de alta, sumar cortes, deshacer los suyos
 *    (dentro de los 10 minutos) y canjear premios. No ve montos ajenos ni la caja; no configura nada.
 */

export type Barbero = { id: string; es_dueno: boolean };

/** Secciones del panel solo para el dueño. */
export const RUTAS_SOLO_DUENO: readonly string[] = [RUTAS.caja, RUTAS.reglas, RUTAS.descuentos];

export function esRutaSoloDueno(path: string): boolean {
  return RUTAS_SOLO_DUENO.some((r) => path === r || path.startsWith(`${r}/`));
}

/** El dueño deshace cualquier corte; el empleado, solo los que cargó él. */
export function puedeDeshacerCorte(
  barbero: Barbero,
  corte: { registrado_por: string | null },
): boolean {
  return barbero.es_dueno || corte.registrado_por === barbero.id;
}

/** Plazo del empleado para deshacer. El dueño tiene, además, todo ese día. */
export const PLAZO_DESHACER_MS = 10 * 60 * 1000;

/**
 * Hasta cuándo (ms) puede deshacer este corte quien mira, o null si no puede.
 * Es la misma regla que deshacer_corte() en la base.
 */
export function venceDeshacer(
  barbero: Barbero,
  corte: { fecha: string; registrado_por: string | null },
): number | null {
  if (!puedeDeshacerCorte(barbero, corte)) return null;
  const diez = new Date(corte.fecha).getTime() + PLAZO_DESHACER_MS;
  return barbero.es_dueno ? Math.max(diez, finDelDia(corte.fecha)) : diez;
}

/** Etiqueta del perfil en el panel. */
export function etiquetaPerfil(barbero: { es_dueno: boolean; es_admin: boolean }): string {
  if (barbero.es_admin) return "Admin";
  return barbero.es_dueno ? "Dueño" : "Barbero";
}
