/**
 * Utilidades de teléfono. El teléfono normalizado es el usuario del cliente,
 * así que la MISMA normalización se aplica al crear la cuenta y al loguear.
 */

const MIN_DIGITOS = 8;
const MAX_DIGITOS = 15;

/**
 * Deja solo dígitos y quita prefijos que la gente escribe de distintas formas
 * en Argentina, para que "+54 9 2346 40-1122", "02346 401122" y "2346401122"
 * sean el mismo usuario.
 */
export function normalizarTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 13 && digitos.startsWith("549")) return digitos.slice(3);
  if (digitos.length === 12 && digitos.startsWith("54")) return digitos.slice(2);
  if (digitos.length === 11 && digitos.startsWith("0")) return digitos.slice(1);
  return digitos;
}

export function esTelefonoValido(normalizado: string): boolean {
  return new RegExp(`^\\d{${MIN_DIGITOS},${MAX_DIGITOS}}$`).test(normalizado);
}

/** Email interno de Supabase Auth para un teléfono. El cliente nunca lo ve. */
export function emailInterno(telefonoNormalizado: string, dominio: string): string {
  return `${telefonoNormalizado}@${dominio}`;
}

/** Formato legible: "2346 40-1122" para números argentinos de 10 dígitos. */
export function formatearTelefono(normalizado: string | null | undefined): string {
  if (!normalizado) return "";
  if (normalizado.length !== 10) return normalizado;
  return `${normalizado.slice(0, 4)} ${normalizado.slice(4, 6)}-${normalizado.slice(6)}`;
}

/** Número para wa.me (formato internacional argentino) o null si no se reconoce. */
export function telefonoWhatsApp(normalizado: string): string | null {
  return /^\d{10}$/.test(normalizado) ? `549${normalizado}` : null;
}

/**
 * Link de WhatsApp con el mensaje armado. Si el número no se reconoce, abre
 * WhatsApp sin destinatario para elegir el contacto a mano.
 */
export function linkWhatsApp(telefonoNormalizado: string, mensaje: string): string {
  const numero = telefonoWhatsApp(telefonoNormalizado);
  const texto = encodeURIComponent(mensaje);
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
}
