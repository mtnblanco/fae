import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/supabase/env";

const REGLA_POR_DEFECTO = {
  cortes_necesarios: 5,
  descripcion_premio: "50% off en el siguiente corte",
};

/**
 * Regla activa para la landing. Usa la clave pública sin cookies (rol anon),
 * así la página se puede cachear. Si algo falla, muestra la regla por defecto.
 */
export async function reglaPublica() {
  if (!supabaseConfigurado) return REGLA_POR_DEFECTO;
  try {
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase
      .from("reglas")
      .select("cortes_necesarios, descripcion_premio")
      .eq("activa", true)
      .maybeSingle();
    return data ?? REGLA_POR_DEFECTO;
  } catch {
    return REGLA_POR_DEFECTO;
  }
}
