import { normalizarTelefono } from "./telefono";

/**
 * Largo mínimo de las contraseñas NUEVAS (alta, reseteo y cambio). El login no
 * lo exige: las contraseñas de antes (de 6 o 7 caracteres) siguen entrando.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // límite de bcrypt en Supabase Auth

/**
 * Las más usadas (en castellano y en general) de 8 caracteres o más. La lista
 * es corta a propósito: cubre lo primero que prueba alguien que adivina.
 */
const COMUNES = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "0123456789",
  "87654321",
  "987654321",
  "12341234",
  "11223344",
  "12121212",
  "123123123",
  "147258369",
  "159753123",
  "password",
  "password1",
  "contraseña",
  "contrasena",
  "contraseña1",
  "contrasena1",
  "qwerty123",
  "qwertyui",
  "1q2w3e4r",
  "abcd1234",
  "abc12345",
  "abcdefgh",
  "asdfghjk",
  "iloveyou",
  "teamo123",
  "argentina",
  "bocajuniors",
  "riverplate",
  "barberia",
  "barbershop",
  "faebarbershop",
  "faebarber",
]);

/** Todos los caracteres iguales ("aaaaaaaa") o dígitos seguidos ("23456789"). */
function esTrivial(password: string): boolean {
  if (/^(.)\1+$/.test(password)) return true;
  if (!/^\d+$/.test(password)) return false;
  const pasos = new Set<number>();
  for (let i = 1; i < password.length; i++) {
    pasos.add(password.charCodeAt(i) - password.charCodeAt(i - 1));
  }
  return pasos.size === 1 && (pasos.has(1) || pasos.has(-1));
}

/** true si la contraseña es de las que se adivinan primero. */
export function esPasswordComun(password: string): boolean {
  const p = password.trim().toLowerCase();
  return COMUNES.has(p) || esTrivial(p);
}

/** true si la contraseña es el número de teléfono (escrito de cualquier forma). */
export function esPasswordTelefono(password: string, telefono: string | null | undefined): boolean {
  if (!telefono) return false;
  const digitos = normalizarTelefono(password);
  // Solo cuenta si la contraseña es el número (dígitos y separadores), no si lo contiene.
  return /^[\d\s()+.-]+$/.test(password) && digitos === normalizarTelefono(telefono);
}

export const MSJ_PASSWORD_COMUN = "Esa contraseña es muy fácil de adivinar. Elegí otra.";
export const MSJ_PASSWORD_TELEFONO = "No uses tu número de teléfono como contraseña.";

// Sin caracteres que se confunden al dictarlos o leerlos (0/o, 1/l/i).
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Contraseña temporal fácil de tipear en el celular: 8 caracteres en minúscula
 * y números, con al menos un número. Usa el generador criptográfico del entorno.
 */
export function generarPassword(largo = 8): string {
  const valores = new Uint32Array(largo);
  for (;;) {
    crypto.getRandomValues(valores);
    const password = Array.from(valores, (v) => ALFABETO[v % ALFABETO.length]).join("");
    if (/\d/.test(password) && /[a-z]/.test(password)) return password;
  }
}
