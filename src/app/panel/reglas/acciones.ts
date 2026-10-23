"use server";

import { revalidatePath } from "next/cache";
import { requireDueno } from "@/lib/auth";
import { mensajeDeErrorDb } from "@/lib/errores";
import { texto } from "@/lib/formularios";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { type ErroresEtapas, validarEtapas } from "@/lib/validaciones";

export type EstadoRegla =
  | { estado: "inicial" }
  | { estado: "ok"; mensaje: string; version: number }
  | { estado: "error"; mensaje?: string; errores?: ErroresEtapas };

/**
 * Guarda las etapas de la regla de premios. Llegan como JSON en el campo
 * `etapas` ([{corte, descripcion}], en el orden de la pantalla).
 */
export async function guardarRegla(_previo: EstadoRegla, formData: FormData): Promise<EstadoRegla> {
  await requireDueno();
  let crudas: unknown;
  try {
    crudas = JSON.parse(texto(formData, "etapas") || "[]");
  } catch {
    return { estado: "error", mensaje: "No pudimos leer las etapas. Recargá la página." };
  }
  const validas = validarEtapas(crudas);
  if (!validas.ok) {
    return {
      estado: "error",
      mensaje: validas.errores.general ?? "Revisá las etapas marcadas.",
      errores: validas.errores,
    };
  }

  const supabase = await createClient();
  // Atómico en la base: valida, desactiva la regla anterior y crea la nueva.
  const { error } = await supabase.rpc("guardar_regla_etapas", { p_etapas: validas.etapas });
  if (error) return { estado: "error", mensaje: mensajeDeErrorDb(error) };

  revalidatePath("/", "layout");
  revalidatePath(RUTAS.panel, "layout");
  return {
    estado: "ok",
    mensaje: "Regla guardada. Ya la ven todos tus clientes.",
    version: Date.now(),
  };
}
