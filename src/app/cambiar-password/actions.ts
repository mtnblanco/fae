"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireUsuario, type Sesion } from "@/lib/auth";
import { mensajeDeErrorAuth } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import {
  claveCambio,
  claveIp,
  ipDelPedido,
  LIMITE_CAMBIO,
  LIMITE_IP,
  type Limite,
  mensajeDeEspera,
} from "@/lib/intentos";
import { consumirIntentos, liberarIntentos } from "@/lib/intentos-servidor";
import { esPasswordTelefono, MSJ_PASSWORD_TELEFONO } from "@/lib/password";
import { RUTAS } from "@/lib/rutas";
import { createAdminClient, createClienteEfimero } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cambiarPasswordSchema, erroresDeCampo } from "@/lib/validaciones";

/**
 * Cambio de contraseña, obligatorio (después de un alta o un reseteo) o
 * voluntario. En el voluntario se pide la contraseña actual. En el obligatorio
 * no: el usuario acaba de entrar con la temporal. Una sesión vieja (por
 * ejemplo, la de quien tenía el celular perdido) no puede elegir la nueva
 * porque el reseteo cierra todas las sesiones, y Supabase rechaza el JWT de una
 * sesión cerrada (lo confirmamos con getUser antes de cambiarla). Al terminar,
 * se cierran las demás sesiones de la cuenta.
 */
export async function cambiarPassword(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const sesion = await requireUsuario({ permitirCambioPendiente: true });
  const obligatorio = sesion.perfil.debe_cambiar_password;

  const parse = cambiarPasswordSchema.safeParse({
    actual: texto(formData, "actual"),
    nueva: texto(formData, "nueva"),
    confirmacion: texto(formData, "confirmacion"),
  });
  if (!parse.success) return { estado: "error", errores: erroresDeCampo(parse.error) };

  const { actual, nueva } = parse.data;
  if (esPasswordTelefono(nueva, sesion.perfil.telefono)) {
    return { estado: "error", errores: { nueva: [MSJ_PASSWORD_TELEFONO] } };
  }
  if (obligatorio) return cambiarObligatoria(sesion, nueva);

  if (!actual) {
    return { estado: "error", errores: { actual: ["Ingresá tu contraseña actual."] } };
  }
  if (!sesion.email) return { estado: "error", mensaje: mensajeDeErrorAuth(null) };

  // Verificar la contraseña vigente es un intento de adivinarla: lleva límite.
  const ip = ipDelPedido(await headers());
  const limites: Limite[] = [
    ...(ip ? [{ clave: claveIp(ip), ...LIMITE_IP }] : []),
    { clave: claveCambio(sesion.userId), ...LIMITE_CAMBIO },
  ];
  const espera = await consumirIntentos(limites);
  if (espera > 0) return { estado: "error", mensaje: mensajeDeEspera(espera) };

  // Se verifica con un cliente aparte, sin tocar la sesión de las cookies.
  const efimero = createClienteEfimero();
  const { error: errorVerificacion } = await efimero.auth.signInWithPassword({
    email: sesion.email,
    password: actual,
  });
  if (errorVerificacion) {
    return errorVerificacion.code === "over_request_rate_limit"
      ? { estado: "error", mensaje: mensajeDeErrorAuth(errorVerificacion) }
      : { estado: "error", errores: { actual: ["La contraseña actual no es correcta."] } };
  }

  const supabase = await createClient();
  let { error } = await supabase.auth.updateUser({ password: nueva });
  // Con "Secure password change" activado, Supabase pide una sesión reciente:
  // la del cliente aparte se acaba de crear al verificar la contraseña.
  if (error?.code === "reauthentication_needed") {
    ({ error } = await efimero.auth.updateUser({ password: nueva }));
  }
  if (error) {
    const mensaje = mensajeDeErrorAuth(error);
    return error.code === "same_password" || error.code === "weak_password"
      ? { estado: "error", errores: { nueva: [mensaje] } }
      : { estado: "error", mensaje };
  }

  await cerrarOtrasSesiones(supabase);

  after(() =>
    liberarIntentos([
      { clave: claveCambio(sesion.userId) },
      ...(ip ? [{ clave: claveIp(ip), soloUltimo: true }] : []),
    ]),
  );

  return {
    estado: "ok",
    mensaje: "¡Listo! Tu contraseña se actualizó y cerramos la sesión en tus otros dispositivos.",
  };
}

/** Primer cambio después de un alta o un reseteo: sin pedir la temporal. */
async function cambiarObligatoria(sesion: Sesion, nueva: string): Promise<EstadoFormulario> {
  const supabase = await createClient();

  // getUser va a Supabase Auth, que rechaza el JWT de una sesión cerrada por un
  // reseteo (getClaims solo valida la firma). Si la sesión ya no existe, que
  // vuelva a entrar con la contraseña nueva que le dio el barbero.
  const { error: errorSesion } = await supabase.auth.getUser();
  if (errorSesion) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(RUTAS.login);
  }

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    if (error.code === "reauthentication_needed" || error.code === "session_not_found") {
      await supabase.auth.signOut({ scope: "local" });
      redirect(RUTAS.login);
    }
    const mensaje = mensajeDeErrorAuth(error);
    return error.code === "same_password" || error.code === "weak_password"
      ? { estado: "error", errores: { nueva: [mensaje] } }
      : { estado: "error", mensaje };
  }

  // El flag solo se baja acá, en el servidor, después de cambiarla con éxito.
  const { error: errorFlag } = await createAdminClient()
    .from("perfiles")
    .update({ debe_cambiar_password: false })
    .eq("id", sesion.userId);
  if (errorFlag) return { estado: "error", mensaje: mensajeDeErrorAuth(null) };

  await cerrarOtrasSesiones(supabase);
  redirect(sesion.perfil.rol === "barbero" ? RUTAS.panel : `${RUTAS.carnet}?bienvenida=1`);
}

/** Cierra las otras sesiones de la cuenta (otros dispositivos y la de la verificación). */
async function cerrarOtrasSesiones(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) console.error("[password] No se cerraron las otras sesiones:", error.message);
}
