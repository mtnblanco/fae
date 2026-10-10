/** Resultado de las Server Actions que se llaman desde botones (no formularios). */
export type Resultado<T = undefined> = { ok: true; datos: T } | { ok: false; error: string };

export const exito = <T>(datos: T): Resultado<T> => ({ ok: true, datos });
export const fallo = (error: string): Resultado<never> => ({ ok: false, error });
