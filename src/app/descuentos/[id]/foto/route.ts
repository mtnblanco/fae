import type { NextRequest } from "next/server";
import { tipoFotoPorBytes } from "@/lib/descuentos";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validaciones";

/**
 * Foto del local de un descuento. Con la sesión del usuario: el RLS deja ver
 * la foto solo a quien ve el descuento (el cliente, la de los vigentes; los
 * barberos, todas). Sin sesión o sin permiso: 404.
 *
 * La URL lleva la versión (?v=, ver urlFotoDescuento): cada foto nueva tiene
 * otra URL, así que el navegador la guarda un año. "private": depende de la
 * sesión, ningún CDN la comparte.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/descuentos/[id]/foto">) {
  const { id } = await ctx.params;
  if (!idSchema.safeParse(id).success) return noEncontrada();

  const supabase = await createClient();
  const { data } = await supabase
    .from("fotos_descuentos")
    .select("tipo, foto")
    .eq("descuento_id", id)
    .maybeSingle();
  if (!data) return noEncontrada();

  const bytes = Buffer.from(data.foto, "base64");
  // La base ya lo valida; por las dudas, nunca se sirve algo que no sea la imagen que dice ser.
  if (tipoFotoPorBytes(bytes) !== data.tipo) return noEncontrada();

  const versionada = request.nextUrl.searchParams.has("v");
  return new Response(bytes, {
    headers: {
      "Content-Type": data.tipo,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": versionada ? "private, max-age=31536000, immutable" : "private, no-cache",
    },
  });
}

function noEncontrada() {
  return new Response("Foto no encontrada.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
