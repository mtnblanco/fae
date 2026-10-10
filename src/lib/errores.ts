/**
 * Traduce los errores de la base (códigos que lanzan las funciones SQL) y de
 * Supabase Auth a mensajes claros para la interfaz.
 */

const MENSAJES_DB: Record<string, string> = {
  no_autorizado: "No tenés permiso para hacer esto.",
  cliente_inexistente: "No encontramos a ese cliente.",
  corte_inexistente: "Ese corte ya no existe (puede que ya se haya deshecho).",
  corte_reciente: "Ya se cargó un corte a este cliente hace instantes.",
  fuera_de_plazo: "Pasaron más de 10 minutos: este corte ya no se puede deshacer.",
  premio_ya_canjeado:
    "Este corte completó un premio que ya se canjeó, así que no se puede deshacer.",
  sin_premios: "Este cliente no tiene premios para canjear.",
  sin_regla: "No hay una regla de premios configurada.",
  solicitud_invalida: "La operación no es válida. Recargá la página e intentá de nuevo.",
};

export const ERROR_GENERICO = "Algo salió mal. Probá de nuevo en un momento.";

type ErrorConMensaje = { message?: string; code?: string } | null | undefined;

export function mensajeDeErrorDb(error: ErrorConMensaje): string {
  if (!error?.message) return ERROR_GENERICO;
  return MENSAJES_DB[error.message] ?? ERROR_GENERICO;
}

/** true si el error es una violación de unicidad (ej.: teléfono repetido). */
export function esDuplicado(error: ErrorConMensaje): boolean {
  return (
    error?.code === "23505" ||
    /already (been )?registered|already exists/i.test(error?.message ?? "")
  );
}

const MENSAJES_AUTH: Record<string, string> = {
  same_password: "La nueva contraseña tiene que ser distinta a la anterior.",
  weak_password: "Esa contraseña es muy débil. Probá con una más larga.",
  over_request_rate_limit: "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.",
  over_email_send_rate_limit: "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.",
};

export function mensajeDeErrorAuth(error: ErrorConMensaje): string {
  if (!error) return ERROR_GENERICO;
  if (error.code && MENSAJES_AUTH[error.code]) return MENSAJES_AUTH[error.code]!;
  return ERROR_GENERICO;
}
