import { type NextRequest, NextResponse } from "next/server";
import { nuevoNonce, politicaCsp } from "@/lib/csp";
import { actualizarSesion, esRutaConSesion } from "@/lib/supabase/proxy";
import { SUPABASE_URL } from "@/lib/supabase/env";

/**
 * En cada página: arma la Content-Security-Policy con un nonce nuevo (Next lo
 * lee de la cabecera del pedido y se lo pone a sus scripts). En las rutas con
 * sesión, además refresca la sesión de Supabase y aplica los redirects.
 */
export async function proxy(request: NextRequest) {
  const csp = politicaCsp({
    nonce: nuevoNonce(),
    supabaseUrl: SUPABASE_URL,
    desarrollo: process.env.NODE_ENV === "development",
  });

  // Siempre con las cookies vigentes del pedido (la sesión puede refrescarlas).
  const siguiente = () => {
    const cabeceras = new Headers(request.headers);
    cabeceras.set("content-security-policy", csp);
    return NextResponse.next({ request: { headers: cabeceras } });
  };

  const respuesta = esRutaConSesion(request.nextUrl.pathname)
    ? await actualizarSesion(request, siguiente)
    : siguiente();
  respuesta.headers.set("Content-Security-Policy", csp);
  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos (no necesitan CSP ni sesión).
    "/((?!_next/static|_next/image|vendor/|iconos/|sw\\.js|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest).*)",
  ],
};
