/** Variables públicas de Supabase (seguras para el navegador). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Acepta la key nueva (publishable) o la legacy (anon). */
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_KEY);

export function exigirConfiguracion(): void {
  if (!supabaseConfigurado) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copiá .env.example como .env.local y completalas.",
    );
  }
}
