"use server";

import { revalidatePath } from "next/cache";
import { requireBarbero } from "@/lib/auth";
import { mensajeDeErrorDb } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { erroresDeCampo, reglaSchema } from "@/lib/validaciones";

export async function guardarRegla(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requireBarbero();
  const valores = {
    cortes_necesarios: texto(formData, "cortes_necesarios"),
    descripcion_premio: texto(formData, "descripcion_premio"),
  };
  const parse = reglaSchema.safeParse(valores);
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error), valores };

  const supabase = await createClient();
  // Atómico en la base: desactiva la regla anterior y crea la nueva.
  const { error } = await supabase.rpc("guardar_regla", {
    p_cortes_necesarios: parse.data.cortes_necesarios,
    p_descripcion_premio: parse.data.descripcion_premio,
  });
  if (error) return { estado: "error", mensaje: mensajeDeErrorDb(error), valores };

  revalidatePath("/", "layout");
  revalidatePath(RUTAS.panel, "layout");
  return { estado: "ok", mensaje: "Regla guardada. Ya la ven todos tus clientes." };
}
