"use server";

import { revalidatePath } from "next/cache";
import { requireBarbero } from "@/lib/auth";
import { ERROR_GENERICO } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { descuentoSchema, erroresDeCampo, idSchema } from "@/lib/validaciones";

// Los descuentos se escriben con la sesión del barbero: el RLS valida el rol.

function revalidar() {
  revalidatePath(RUTAS.descuentos);
  revalidatePath(RUTAS.carnet);
}

export async function guardarDescuento(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requireBarbero();
  const valores = {
    comercio: texto(formData, "comercio"),
    descripcion: texto(formData, "descripcion"),
    vigente_desde: texto(formData, "vigente_desde"),
    vigente_hasta: texto(formData, "vigente_hasta"),
  };
  const id = texto(formData, "id") || undefined;
  const parse = descuentoSchema.safeParse({
    ...valores,
    id,
    activo: formData.get("activo") === "on",
  });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error), valores };

  const { id: idValido, ...datos } = parse.data;
  const supabase = await createClient();
  const { error } = idValido
    ? await supabase.from("descuentos_asociados").update(datos).eq("id", idValido)
    : await supabase.from("descuentos_asociados").insert(datos);
  if (error) return { estado: "error", mensaje: ERROR_GENERICO, valores };

  revalidar();
  return { estado: "ok", mensaje: idValido ? "Descuento actualizado" : "Descuento creado" };
}

export async function cambiarActivoDescuento(id: string, activo: boolean): Promise<Resultado> {
  await requireBarbero();
  if (!idSchema.safeParse(id).success) return fallo("Descuento inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("descuentos_asociados").update({ activo }).eq("id", id);
  if (error) return fallo(ERROR_GENERICO);
  revalidar();
  return exito(undefined);
}

export async function eliminarDescuento(id: string): Promise<Resultado> {
  await requireBarbero();
  if (!idSchema.safeParse(id).success) return fallo("Descuento inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("descuentos_asociados").delete().eq("id", id);
  if (error) return fallo(ERROR_GENERICO);
  revalidar();
  return exito(undefined);
}
