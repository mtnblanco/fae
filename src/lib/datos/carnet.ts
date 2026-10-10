import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Todo lo que ve el cliente en su carnet. El RLS garantiza que sean SUS datos. */
export async function datosCarnet(clienteId: string) {
  const supabase = await createClient();
  const [resumen, cortes, canjes, descuentos] = await Promise.all([
    supabase.from("resumen_clientes").select("*").eq("id", clienteId).maybeSingle(),
    supabase
      .from("cortes")
      .select("id, fecha")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false }),
    supabase
      .from("canjes")
      .select("id, fecha, premio_descripcion")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false }),
    // El RLS ya filtra activos y vigentes para el cliente.
    supabase
      .from("descuentos_asociados")
      .select("id, comercio, descripcion, vigente_hasta")
      .order("comercio", { ascending: true }),
  ]);

  const error = resumen.error ?? cortes.error ?? canjes.error ?? descuentos.error;
  if (error) throw new Error(`No se pudo cargar el carnet: ${error.message}`);
  if (!resumen.data) return null;

  return {
    cliente: resumen.data,
    cortes: cortes.data ?? [],
    canjes: canjes.data ?? [],
    descuentos: descuentos.data ?? [],
  };
}
