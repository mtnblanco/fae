import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Perfil } from "@/lib/database.types";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";

export type Sesion = {
  userId: string;
  email: string | null;
  perfil: Pick<
    Perfil,
    "id" | "nombre" | "telefono" | "rol" | "debe_cambiar_password" | "es_dueno" | "es_admin"
  >;
};

/**
 * Sesión verificada del usuario actual (una vez por request).
 * `getClaims()` valida la firma del JWT; el perfil se lee con RLS.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, telefono, rol, debe_cambiar_password, es_dueno, es_admin")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!perfil) return null;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    perfil,
  };
});

type Opciones = { permitirCambioPendiente?: boolean };

/** Exige un usuario logueado con perfil. Si debe cambiar la contraseña, lo manda a hacerlo. */
export async function requireUsuario({
  permitirCambioPendiente = false,
}: Opciones = {}): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect(RUTAS.login);
  if (sesion.perfil.debe_cambiar_password && !permitirCambioPendiente)
    redirect(RUTAS.cambiarPassword);
  return sesion;
}

export async function requireBarbero(): Promise<Sesion> {
  const sesion = await requireUsuario();
  if (sesion.perfil.rol !== "barbero") redirect(RUTAS.carnet);
  return sesion;
}

/** Solo el barbero dueño o el admin (caja, precios, regla de premios, descuentos, bajas). */
export async function requireDueno(): Promise<Sesion> {
  const sesion = await requireBarbero();
  if (!sesion.perfil.es_dueno) redirect(RUTAS.panel);
  return sesion;
}

export async function requireCliente(): Promise<Sesion> {
  const sesion = await requireUsuario();
  if (sesion.perfil.rol !== "cliente") redirect(RUTAS.panel);
  return sesion;
}

/**
 * Para las acciones que usan la clave de servicio (alta, edición, reseteo y
 * baja de clientes): confirma EN LA BASE que la cuenta sigue siendo un barbero
 * activo. El JWT vale hasta una hora aunque el empleado haya sido bloqueado
 * (`quitar-empleado.sql`); `es_barbero()` / `es_dueno()` miran el bloqueo.
 */
export async function barberoActivoEnBase(soloDueno = false): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(soloDueno ? "es_dueno" : "es_barbero");
  return !error && data === true;
}
