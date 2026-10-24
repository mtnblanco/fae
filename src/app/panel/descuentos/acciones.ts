"use server";

import { revalidatePath } from "next/cache";
import { requireDueno } from "@/lib/auth";
import type { TipoFoto } from "@/lib/database.types";
import { tipoFotoPorBytes } from "@/lib/descuentos";
import { ERROR_GENERICO, mensajeDeErrorDb } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { descuentoSchema, erroresDeCampo, fotoDescuentoSchema, idSchema } from "@/lib/validaciones";

// Los descuentos se escriben con la sesión del barbero: el RLS valida el rol.
// La foto del local, con funciones que exigen ser dueño (guardar_foto_descuento).

function revalidar() {
  revalidatePath(RUTAS.descuentos);
  revalidatePath(RUTAS.carnet);
}

type CambioFoto =
  { tipo: "ninguno" } | { tipo: "quitar" } | { tipo: "poner"; mime: TipoFoto; base64: string };

/**
 * La foto del local que viene del formulario (ya comprimida en el navegador).
 * Nunca confía en el navegador: tipo y tamaño con zod, y el formato real por
 * los primeros bytes. La base vuelve a validar todo (guardar_foto_descuento).
 */
async function leerFoto(formData: FormData): Promise<CambioFoto | { error: string }> {
  const archivo = formData.get("foto");
  if (archivo === null || (archivo instanceof File && archivo.size === 0)) {
    return formData.get("quitar_foto") === "1" ? { tipo: "quitar" } : { tipo: "ninguno" };
  }
  const parse = fotoDescuentoSchema.safeParse(archivo);
  if (!parse.success) return { error: parse.error.issues[0]?.message ?? "Foto inválida." };
  const bytes = new Uint8Array(await parse.data.arrayBuffer());
  const mime = tipoFotoPorBytes(bytes);
  if (!mime || mime !== parse.data.type)
    return { error: "La foto tiene que ser JPG o WebP. Probá con otra." };
  return { tipo: "poner", mime, base64: Buffer.from(bytes).toString("base64") };
}

export async function guardarDescuento(
  _previo: EstadoFormulario<{ avisoFoto: boolean }>,
  formData: FormData,
): Promise<EstadoFormulario<{ avisoFoto: boolean }>> {
  await requireDueno();
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
  const foto = await leerFoto(formData);
  if (!parse.success || "error" in foto) {
    return {
      estado: "error",
      errores: {
        ...(parse.success ? {} : erroresDeCampo(parse.error)),
        ...("error" in foto ? { foto: [foto.error] } : {}),
      },
      valores,
    };
  }

  const { id: idValido, ...datos } = parse.data;
  const supabase = await createClient();
  const { data, error } = idValido
    ? await supabase
        .from("descuentos_asociados")
        .update(datos)
        .eq("id", idValido)
        .select("id")
        .single()
    : await supabase.from("descuentos_asociados").insert(datos).select("id").single();
  if (error || !data) return { estado: "error", mensaje: ERROR_GENERICO, valores };

  const mensaje = idValido ? "Descuento actualizado" : "Descuento creado";
  if (foto.tipo !== "ninguno") {
    const { error: errorFoto } =
      foto.tipo === "poner"
        ? await supabase.rpc("guardar_foto_descuento", {
            p_descuento: data.id,
            p_tipo: foto.mime,
            p_foto: foto.base64,
          })
        : await supabase.rpc("quitar_foto_descuento", { p_descuento: data.id });
    if (errorFoto) {
      // El descuento ya quedó guardado: se cierra el diálogo y se avisa.
      revalidar();
      return {
        estado: "ok",
        mensaje: `${mensaje}, pero no se pudo ${foto.tipo === "poner" ? "guardar" : "quitar"} la foto. ${mensajeDeErrorDb(errorFoto)}`,
        datos: { avisoFoto: true },
      };
    }
  }

  revalidar();
  return { estado: "ok", mensaje };
}

export async function cambiarActivoDescuento(id: string, activo: boolean): Promise<Resultado> {
  await requireDueno();
  if (!idSchema.safeParse(id).success) return fallo("Descuento inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("descuentos_asociados").update({ activo }).eq("id", id);
  if (error) return fallo(ERROR_GENERICO);
  revalidar();
  return exito(undefined);
}

export async function eliminarDescuento(id: string): Promise<Resultado> {
  await requireDueno();
  if (!idSchema.safeParse(id).success) return fallo("Descuento inválido.");
  const supabase = await createClient();
  const { error } = await supabase.from("descuentos_asociados").delete().eq("id", id);
  if (error) return fallo(ERROR_GENERICO);
  revalidar();
  return exito(undefined);
}
