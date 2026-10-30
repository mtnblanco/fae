import "server-only";
import { aNumero } from "@/lib/dinero";
import { createClient } from "@/lib/supabase/server";

export type EstadoMensualidad = {
  /** Mensualidad activa (le quedan cortes), o null si es cliente común. */
  activa: { id: string; incluidos: number; usos: string[]; desde: string } | null;
  /** Precio de mensualidad del barbero que mira (para precargarlo al cobrar). */
  precioBarbero: number | null;
};

/** Mensualidad del cliente. La pide un barbero o el propio cliente (lo valida la base). */
export async function estadoMensualidad(clienteId: string): Promise<EstadoMensualidad> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estado_mensualidad", { p_cliente: clienteId });
  if (error) throw new Error(`No se pudo cargar la mensualidad: ${error.message}`);
  const f = data?.[0];
  return {
    activa:
      f?.activa && f.mensualidad_id && f.desde
        ? { id: f.mensualidad_id, incluidos: f.cortes_incluidos ?? 4, usos: f.usos, desde: f.desde }
        : null,
    precioBarbero: aNumero(f?.precio_barbero),
  };
}
