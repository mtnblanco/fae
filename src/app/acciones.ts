"use server";

import { redirect } from "next/navigation";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";

export async function cerrarSesion(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(RUTAS.login);
}
