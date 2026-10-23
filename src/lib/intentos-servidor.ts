import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Limite } from "./intentos";

/**
 * Registra un intento por cada límite, en orden, y corta en el primero que
 * esté agotado (así un pedido bloqueado por IP no gasta el cupo de la cuenta).
 * Devuelve 0 si se puede seguir, o los segundos que hay que esperar.
 *
 * Si la base no responde (o la migración todavía no se aplicó), deja pasar:
 * mejor un login sin límite propio que nadie pudiendo entrar. Supabase Auth
 * tiene además su propio límite.
 */
export async function consumirIntentos(limites: Limite[]): Promise<number> {
  try {
    const admin = createAdminClient();
    for (const { clave, max, ventanaSeg } of limites) {
      const { data, error } = await admin.rpc("consumir_intento", {
        p_clave: clave,
        p_max: max,
        p_ventana_seg: ventanaSeg,
      });
      if (error) throw new Error(error.message);
      if (typeof data === "number" && data > 0) return data;
    }
  } catch (e) {
    console.error("[intentos] No se pudo consultar el límite:", e instanceof Error ? e.message : e);
  }
  return 0;
}

/**
 * Después de un intento correcto: borra los intentos de la cuenta/usuario y
 * descuenta el de la IP (un acierto no cuenta como intento). Nunca lanza.
 */
export async function liberarIntentos(claves: { clave: string; soloUltimo?: boolean }[]) {
  try {
    const admin = createAdminClient();
    await Promise.all(
      claves.map(({ clave, soloUltimo = false }) =>
        admin.rpc("limpiar_intentos", { p_clave: clave, p_solo_ultimo: soloUltimo }),
      ),
    );
  } catch (e) {
    console.error("[intentos] No se pudieron limpiar:", e instanceof Error ? e.message : e);
  }
}
