import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: ["/login", "/cambiar-password", "/carnet/:path*", "/panel/:path*", "/turnos/:path*"],
};
