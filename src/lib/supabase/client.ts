import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

let cliente: SupabaseClient<Database> | undefined;

/** Cliente del navegador (singleton). Usa la sesión guardada en cookies. */
export function createClient(): SupabaseClient<Database> {
  cliente ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  return cliente;
}
