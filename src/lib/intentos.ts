/**
 * Límite de intentos de login y de verificación de contraseña (sin servicios
 * pagos: una tabla en Postgres, ver `consumir_intento()` en la migración
 * 20261025000100). Lo que se decide acá es puro, para poder probarlo.
 *
 * Límites (pensados para no molestar a un cliente que se equivoca un par de
 * veces, y para que bloquear a otro no sea fácil):
 *   · Por IP: 20 intentos fallidos cada 10 minutos (login y verificación de
 *     contraseña juntos). Los logins correctos no cuentan.
 *   · Por cuenta: 10 intentos fallidos cada 15 minutos. Un login correcto la
 *     vuelve a cero. Frena a quien prueba contraseñas desde muchas IPs.
 *   · Cambio de contraseña: 8 verificaciones fallidas cada 15 minutos por usuario.
 */
export type Limite = { clave: string; max: number; ventanaSeg: number };

export const LIMITE_IP = { max: 20, ventanaSeg: 10 * 60 };
export const LIMITE_CUENTA = { max: 10, ventanaSeg: 15 * 60 };
export const LIMITE_CAMBIO = { max: 8, ventanaSeg: 15 * 60 };

export const claveIp = (ip: string) => `auth:ip:${ip}`;
export const claveCuenta = (email: string) => `login:cuenta:${email.trim().toLowerCase()}`;
export const claveCambio = (userId: string) => `password:usuario:${userId}`;

const IP_VALIDA = /^[0-9a-f.:]{2,64}$/i;

/**
 * IP del cliente. En Vercel, `x-real-ip` y `x-forwarded-for` los pone la
 * plataforma (pisa lo que mande el navegador). Sin cabecera (por ejemplo, en
 * desarrollo) devuelve null y solo se aplica el límite por cuenta.
 */
export function ipDelPedido(cabeceras: Pick<Headers, "get">): string | null {
  const candidata =
    cabeceras.get("x-real-ip")?.trim() || cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim();
  return candidata && IP_VALIDA.test(candidata) ? candidata.toLowerCase() : null;
}

/** "Demasiados intentos. Probá de nuevo en 3 minutos." */
export function mensajeDeEspera(segundos: number): string {
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  return `Demasiados intentos. Probá de nuevo en ${minutos === 1 ? "1 minuto" : `${minutos} minutos`}.`;
}
