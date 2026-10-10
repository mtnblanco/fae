import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { exigirConfiguracion, SUPABASE_KEY, SUPABASE_URL } from "./env";

/**
 * Cliente con la clave secreta (service role): SALTEA el RLS.
 *
 * Solo para operaciones de administración de usuarios (alta, edición, reseteo
 * y baja de clientes) y SIEMPRE después de verificar que quien llama es el
 * barbero. `server-only` hace fallar el build si se importa desde el navegador.
 */
export function createAdminClient() {
  exigirConfiguracion();
  const secreta = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secreta) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.");
  }
  return createSupabaseClient<Database>(SUPABASE_URL, secreta, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Cliente sin sesión persistente, para verificar una contraseña sin tocar la
 * sesión actual del usuario (cambio voluntario de contraseña).
 */
export function createClienteEfimero() {
  exigirConfiguracion();
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Dominio de los emails internos de los clientes (`{telefono}@dominio`). */
export function dominioEmailClientes(): string {
  return process.env.CLIENTES_EMAIL_DOMAIN?.trim() || "clientes.local";
}
