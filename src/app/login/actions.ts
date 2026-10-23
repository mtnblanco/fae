"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { mensajeDeErrorAuth } from "@/lib/errores";
import { type EstadoFormulario, texto } from "@/lib/formularios";
import {
  claveCuenta,
  claveIp,
  ipDelPedido,
  LIMITE_CUENTA,
  LIMITE_IP,
  type Limite,
  mensajeDeEspera,
} from "@/lib/intentos";
import { consumirIntentos, liberarIntentos } from "@/lib/intentos-servidor";
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

  // Límite propio por IP y por cuenta (el de Supabase Auth ve la IP del servidor).
  const ip = ipDelPedido(await headers());
  const limites: Limite[] = [
    ...(ip ? [{ clave: claveIp(ip), ...LIMITE_IP }] : []),
    { clave: claveCuenta(email), ...LIMITE_CUENTA },
  ];
  const espera = await consumirIntentos(limites);
  if (espera > 0) return { estado: "error", mensaje: mensajeDeEspera(espera), valores };

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

  // Login correcto: la cuenta vuelve a cero y este intento no cuenta para la IP.
  after(() =>
    liberarIntentos([
      { clave: claveCuenta(email) },
      ...(ip ? [{ clave: claveIp(ip), soloUltimo: true }] : []),
    ]),
  );
  redirect(destinoSegunPerfil(perfil));
}
