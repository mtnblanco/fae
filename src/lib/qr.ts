const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

/**
 * Extrae el id del cliente de lo que leyó el escáner. El QR del carnet trae
 * la URL `/panel/clientes/{id}`; también se acepta el id suelto.
 * Devuelve null si no es un carnet nuestro.
 */
export function idDesdeQr(texto: string): string | null {
  const limpio = texto.trim();
  const suelto = limpio.match(new RegExp(`^${UUID.source}$`, "i"));
  if (suelto) return suelto[0].toLowerCase();
  try {
    const url = new URL(limpio);
    const m = url.pathname.match(new RegExp(`^/panel/clientes/(${UUID.source})/?$`, "i"));
    return m?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
