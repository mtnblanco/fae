"use server";

import { redirect } from "next/navigation";
import { mensajeDeErrorAuth } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import { destinoSegunPerfil } from "@/lib/rutas";
import { dominioEmailClientes } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailInterno } from "@/lib/telefono";
import { erroresDeCampo, loginSchema } from "@/lib/validaciones";

const CREDENCIALES_INVALIDAS = {
  telefono: "Teléfono o contraseña incorrectos.",
  email: "Email o contraseña incorrectos.",
} as const;

export async function iniciarSesion(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  // Si lo que se escribió tiene "@", es un email aunque el formulario esté en modo teléfono.
  const modo =
    texto(formData, "modo") === "email" || texto(formData, "usuario").includes("@")
      ? "email"
      : "telefono";
  const crudo = {
    modo,
    usuario: texto(formData, "usuario"),
    password: texto(formData, "password"),
  };
  const valores = { usuario: crudo.usuario };

  const parse = loginSchema.safeParse(crudo);
  if (!parse.success) {
    return { estado: "error", errores: erroresDeCampo(parse.error), valores };
  }

  const { usuario, password } = parse.data;
  const email =
    parse.data.modo === "email" ? usuario : emailInterno(usuario, dominioEmailClientes());

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const porLimite = error?.code === "over_request_rate_limit";
    // Mensaje genérico: no revela si el teléfono o el email existen.
    return {
      estado: "error",
      mensaje: porLimite ? mensajeDeErrorAuth(error) : CREDENCIALES_INVALIDAS[modo],
      valores,
    };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol, debe_cambiar_password")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!perfil) {
    await supabase.auth.signOut();
    return { estado: "error", mensaje: CREDENCIALES_INVALIDAS[modo], valores };
  }

  redirect(destinoSegunPerfil(perfil));
}
