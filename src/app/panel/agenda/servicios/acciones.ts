"use server";

import { revalidatePath } from "next/cache";
import { requireBarbero } from "@/lib/auth";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { mensajeDeErrorTurno } from "@/lib/turnos/errores";
import { mensajeDeErrorDb } from "@/lib/errores";
import { erroresDeCampo, idSchema, precioClienteSchema, servicioSchema } from "@/lib/validaciones";

// Los servicios se escriben con funciones de la base que vuelven a verificar
// quién llama: el empleado, los suyos; el dueño (y el admin), los de cualquiera.

function revalidar() {
  revalidatePath(RUTAS.servicios);
  // El cliente ve los servicios al sacar turno.
  revalidatePath(RUTAS.turnos, "layout");
}

/** Alta o edición de un servicio (formulario del diálogo). */
export async function guardarServicio(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requireBarbero();
  const valores = {
    nombre: texto(formData, "nombre"),
    descripcion: texto(formData, "descripcion"),
    precio: texto(formData, "precio"),
  };
  const parse = servicioSchema.safeParse({
    ...valores,
    id: texto(formData, "id") || undefined,
    barberoId: texto(formData, "barbero_id"),
  });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error), valores };

  const d = parse.data;
  const supabase = await createClient();
  const { error } = d.id
    ? await supabase.rpc("editar_servicio", {
        p_servicio: d.id,
        p_nombre: d.nombre,
        p_precio: d.precio,
        p_descripcion: d.descripcion,
      })
    : await supabase.rpc("crear_servicio", {
        p_barbero: d.barberoId,
        p_nombre: d.nombre,
        p_precio: d.precio,
        p_descripcion: d.descripcion,
      });
  if (error) {
    // El nombre repetido se marca en su campo; lo demás, arriba del formulario.
    if (error.message === "servicio_repetido") {
      return { estado: "error", errores: { nombre: [mensajeDeErrorTurno(error)] }, valores };
    }
    return { estado: "error", mensaje: mensajeDeErrorTurno(error), valores };
  }

  revalidar();
  return { estado: "ok", mensaje: d.id ? "Servicio actualizado" : "Servicio agregado" };
}

/** Pausar (los clientes dejan de verlo) o volver a ofrecer un servicio. */
export async function activarServicio(id: string, activo: boolean): Promise<Resultado> {
  await requireBarbero();
  if (!idSchema.safeParse(id).success || typeof activo !== "boolean") {
    return fallo("Ese servicio ya no existe.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("activar_servicio", { p_servicio: id, p_activo: activo });
  if (error) return fallo(mensajeDeErrorTurno(error));
  revalidar();
  return exito(undefined);
}

/** Los turnos ya reservados con este servicio conservan su nombre y precio. */
export async function borrarServicio(id: string): Promise<Resultado> {
  await requireBarbero();
  if (!idSchema.safeParse(id).success) return fallo("Ese servicio ya no existe.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("borrar_servicio", { p_servicio: id });
  if (error) return fallo(mensajeDeErrorTurno(error));
  revalidar();
  return exito(undefined);
}

/** Precio de la mensualidad (4 cortes) de un barbero. Vacío = sin precio. */
export async function guardarPrecioMensualidad(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await requireBarbero();
  const valores = { precio: texto(formData, "precio") };
  const parse = precioClienteSchema.safeParse({ ...valores, id: texto(formData, "id") });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error), valores };
  if (parse.data.precio === 0) {
    return {
      estado: "error",
      errores: { precio: ["El precio tiene que ser mayor a $ 0."] },
      valores,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_precio_mensualidad", {
    p_barbero: parse.data.id,
    p_precio: parse.data.precio,
  });
  if (error) return { estado: "error", mensaje: mensajeDeErrorDb(error), valores };

  revalidatePath(RUTAS.servicios);
  revalidatePath(RUTAS.panel, "layout");
  return { estado: "ok", mensaje: "Precio de la mensualidad guardado" };
}
