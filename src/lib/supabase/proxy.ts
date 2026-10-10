import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { destinoSegunPerfil, RUTAS } from "@/lib/rutas";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from "./env";

const empiezaCon = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/**
 * Refresca la sesión de Supabase (cookies) y aplica los chequeos optimistas
 * de acceso. La verificación definitiva se repite en el servidor
 * (`requireBarbero` / `requireCliente`) y en la base (RLS).
 */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  if (!supabaseConfigurado) return respuesta;

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          respuesta.cookies.set(name, value, options);
      },
    },
  });

  // No poner código entre createServerClient y getClaims (recomendación de Supabase).
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  const path = request.nextUrl.pathname;
  const enPanel = empiezaCon(path, RUTAS.panel);
  const enCarnet = empiezaCon(path, RUTAS.carnet);
  const enCambio = path === RUTAS.cambiarPassword;
  const enLogin = path === RUTAS.login;

  const redirigir = (destino: string) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    url.search = "";
    const r = NextResponse.redirect(url);
    // Conserva las cookies de sesión que se hayan refrescado.
    for (const cookie of respuesta.cookies.getAll()) r.cookies.set(cookie);
    return r;
  };

  if (!userId) {
    return enPanel || enCarnet || enCambio ? redirigir(RUTAS.login) : respuesta;
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, debe_cambiar_password")
    .eq("id", userId)
    .maybeSingle();

  // Sesión válida pero sin perfil (no debería pasar): que vuelva a loguearse.
  if (!perfil) return enLogin ? respuesta : redirigir(RUTAS.login);

  if (perfil.debe_cambiar_password && !enCambio) return redirigir(RUTAS.cambiarPassword);
  if (enLogin) return redirigir(destinoSegunPerfil(perfil));
  if (enPanel && perfil.rol !== "barbero") return redirigir(RUTAS.carnet);
  if (enCarnet && perfil.rol !== "cliente") return redirigir(RUTAS.panel);

  return respuesta;
}
