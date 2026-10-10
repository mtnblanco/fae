"use server";

import { redirect } from "next/navigation";
import { requireUsuario } from "@/lib/auth";
import { mensajeDeErrorAuth } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import { RUTAS } from "@/lib/rutas";
import { createAdminClient, createClienteEfimero } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cambiarPasswordSchema, erroresDeCampo } from "@/lib/validaciones";

export async function cambiarPassword(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const sesion = await requireUsuario({ permitirCambioPendiente: true });
  const obligatorio = sesion.perfil.debe_cambiar_password;

  const parse = cambiarPasswordSchema.safeParse({
    actual: obligatorio ? undefined : texto(formData, "actual"),
    nueva: texto(formData, "nueva"),
    confirmacion: texto(formData, "confirmacion"),
  });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error) };

  const { actual, nueva } = parse.data;

  // En el cambio voluntario pedimos la contraseña actual.
  if (!obligatorio) {
    if (!actual) return { estado: "error", errores: { actual: ["Ingresá tu contraseña actual."] } };
    if (!sesion.email) return { estado: "error", mensaje: mensajeDeErrorAuth(null) };
    const { error } = await createClienteEfimero().auth.signInWithPassword({
      email: sesion.email,
      password: actual,
    });
    if (error) {
      return error.code === "over_request_rate_limit"
        ? { estado: "error", mensaje: mensajeDeErrorAuth(error) }
        : { estado: "error", errores: { actual: ["La contraseña actual no es correcta."] } };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    const mensaje = mensajeDeErrorAuth(error);
    return error.code === "same_password" || error.code === "weak_password"
      ? { estado: "error", errores: { nueva: [mensaje] } }
      : { estado: "error", mensaje };
  }

  // El flag solo se baja acá, en el servidor, después de cambiarla con éxito.
  if (obligatorio) {
    const { error: errorFlag } = await createAdminClient()
      .from("perfiles")
      .update({ debe_cambiar_password: false })
      .eq("id", sesion.userId);
    if (errorFlag) return { estado: "error", mensaje: mensajeDeErrorAuth(null) };
  }

  if (obligatorio) {
    redirect(sesion.perfil.rol === "barbero" ? RUTAS.panel : `${RUTAS.carnet}?bienvenida=1`);
  }
  return { estado: "ok", mensaje: "¡Listo! Tu contraseña se actualizó." };
}
