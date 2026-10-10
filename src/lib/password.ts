export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 72; // límite de bcrypt en Supabase Auth

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
