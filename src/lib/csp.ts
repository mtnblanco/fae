/**
 * Content-Security-Policy de las páginas (la arma `proxy.ts` en cada pedido,
 * con un nonce nuevo). Next aplica el nonce solo a sus scripts; un script
 * inyectado (XSS) no lo tiene y el navegador no lo ejecuta.
 *
 *   · script-src: nonce + 'strict-dynamic' (los chunks que carga Next heredan
 *     la confianza) + 'wasm-unsafe-eval' para el lector de QR en WebAssembly
 *     (public/vendor/zxing_reader.wasm, iPhone). En desarrollo, 'unsafe-eval'
 *     (React lo usa para los errores).
 *   · style-src 'unsafe-inline': framer-motion, Radix y sonner ponen estilos en
 *     línea (atributos style y <style>). Inyectar estilos no ejecuta código.
 *   · connect-src: la app y Supabase (REST, Auth y Realtime por wss).
 *   · img-src data: blob: (QR e íconos en data URI).
 *   · worker-src 'self': el service worker de las notificaciones (/sw.js).
 *   · frame-ancestors 'none', object-src 'none', base-uri y form-action 'self'.
 */
export function politicaCsp({
  nonce,
  supabaseUrl,
  desarrollo,
}: {
  nonce: string;
  supabaseUrl: string;
  desarrollo: boolean;
}): string {
  const supabase = origen(supabaseUrl);
  const realtime = supabase?.replace(/^http/, "ws");
  const directivas: [string, ...string[]][] = [
    ["default-src", "'self'"],
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      ...(desarrollo ? ["'unsafe-eval'"] : []),
    ],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "data:", "blob:"],
    ["font-src", "'self'"],
    ["connect-src", "'self'", ...(supabase && realtime ? [supabase, realtime] : [])],
    ["media-src", "'self'", "blob:"],
    ["worker-src", "'self'"],
    ["manifest-src", "'self'"],
    ["frame-src", "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  // Solo en producción con https (en local, Supabase va por http).
  const https = !desarrollo && supabase?.startsWith("https://");
  return [...directivas.map((d) => d.join(" ")), ...(https ? ["upgrade-insecure-requests"] : [])]
    .join("; ")
    .concat(";");
}

function origen(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Nonce aleatorio (128 bits) en base64. */
export function nuevoNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
