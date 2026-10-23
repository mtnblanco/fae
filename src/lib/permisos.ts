import { RUTAS } from "@/lib/rutas";

/**
 * Qué puede hacer cada barbero. Es la misma regla que aplica la base (RLS y
 * funciones SQL); acá sirve para el proxy, los guards y para no mostrar botones
 * que el empleado no puede usar.
 *
 *  · Dueño: todo.
 *  · Admin (es_dueno + es_admin): todo lo del dueño, pero no atiende: no tiene
 *    horarios, turnos ni agenda propia, y no se ofrece a los clientes.
 *  · Empleado: buscar, escanear, dar de alta, sumar cortes, deshacer los suyos y
 *    canjear premios. No ve montos ajenos ni la caja; no configura nada.
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

/** Etiqueta del perfil en el panel. */
export function etiquetaPerfil(barbero: { es_dueno: boolean; es_admin: boolean }): string {
  if (barbero.es_admin) return "Admin";
  return barbero.es_dueno ? "Dueño" : "Barbero";
}
