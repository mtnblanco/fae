"use server";

import { revalidatePath } from "next/cache";
import { requireBarbero } from "@/lib/auth";
import type { MedioPago } from "@/lib/database.types";
import { mensajeDeErrorDb } from "@/lib/errores";
import { exito, fallo, type Resultado } from "@/lib/resultado";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { idSchema, servicioHechoSchema } from "@/lib/validaciones";

// Se escriben con funciones de la base que vuelven a verificar quién llama:
// el empleado carga y deshace los suyos; el dueño, los de cualquiera.

function revalidar() {
  revalidatePath(RUTAS.panel, "layout");
}

export type DatosServicioHecho = {
  barberoId: string;
  servicioId: string | null;
  nombre: string;
  monto: number | null;
  medio: MedioPago | null;
  nota: string;
};

/** Carga un servicio cobrado a alguien que no es cliente registrado (no suma sellos). */
export async function registrarServicioHecho(
  datos: DatosServicioHecho,
  solicitudId: string,
): Promise<Resultado<{ id: string; nombre: string; monto: number; medio: MedioPago }>> {
  await requireBarbero();
  if (!idSchema.safeParse(solicitudId).success) return fallo("Solicitud inválida.");
  const parse = servicioHechoSchema.safeParse(datos);
  if (!parse.success) return fallo(parse.error.issues[0]?.message ?? "Revisá los datos.");

  const d = parse.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("registrar_servicio_hecho", {
    p_barbero: d.barberoId,
    p_monto: d.monto,
    p_medio_pago: d.medio,
    p_servicio: d.servicioId,
    p_nombre: d.nombre || null,
    p_nota: d.nota || null,
    p_solicitud_id: solicitudId,
  });
  if (error || !data) return fallo(mensajeDeErrorDb(error));

  revalidar();
  return exito({
    id: data.id,
    nombre: data.servicio_nombre,
    monto: Number(data.monto),
    medio: data.medio_pago,
  });
}

export async function deshacerServicioHecho(id: string): Promise<Resultado> {
  await requireBarbero();
  if (!idSchema.safeParse(id).success) return fallo("Servicio inválido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("deshacer_servicio_hecho", { p_id: id });
  if (error) return fallo(mensajeDeErrorDb(error));
  revalidar();
  return exito(undefined);
}
