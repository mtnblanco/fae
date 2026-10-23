import "server-only";
import webpush from "web-push";
import { urlDelSitio } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { endpointPushValido } from "./endpoints";
import { type Aviso, enviarATodas, type Suscripcion } from "./envio";

/** Como mucho, los 10 dispositivos más recientes (la base tampoco guarda más). */
const MAX_DISPOSITIVOS = 10;
/** Un servicio push real responde en milisegundos: no se espera más. */
const TIMEOUT_MS = 4000;

/**
 * Notificaciones Web Push a los barberos (VAPID). Sin claves configuradas,
 * todo sigue funcionando: simplemente no se manda nada.
 *
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  clave pública (también la usa el navegador)
 *   VAPID_PRIVATE_KEY             clave privada (solo servidor)
 *   VAPID_SUBJECT                 opcional: "mailto:…" o la URL del sitio
 */
const PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVADA = process.env.VAPID_PRIVATE_KEY ?? "";

export const pushConfigurado = () => Boolean(PUBLICA && PRIVADA);

let configurado = false;
function configurar() {
  if (configurado) return;
  const sujeto = process.env.VAPID_SUBJECT?.trim() || urlDelSitio();
  // En local la URL es http://localhost: el estándar pide https o mailto.
  webpush.setVapidDetails(
    sujeto.startsWith("https://") || sujeto.startsWith("mailto:")
      ? sujeto
      : "mailto:turnos@faebarbershop.invalid",
    PUBLICA,
    PRIVADA,
  );
  configurado = true;
}

/**
 * Avisa a un barbero en todos sus dispositivos. Se llama dentro de `after()`,
 * así no demora la respuesta al cliente. Nunca lanza.
 */
export async function avisarBarbero(barberoId: string, aviso: Aviso): Promise<void> {
  if (!pushConfigurado()) return;
  try {
    configurar();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("suscripciones_push")
      .select("id, endpoint, p256dh, auth")
      .eq("barbero_id", barberoId)
      .order("actualizada_en", { ascending: false })
      .limit(MAX_DISPOSITIVOS);
    if (error) throw new Error(error.message);
    // Defensa extra (filas viejas o cargadas a mano): nunca se le hace un
    // pedido a algo que no sea un servicio push.
    const suscripciones = ((data ?? []) as Suscripcion[]).filter((s) =>
      endpointPushValido(s.endpoint),
    );
    if (suscripciones.length === 0) return;

    const r = await enviarATodas(suscripciones, aviso, (s, cuerpo) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        cuerpo,
        { TTL: 60 * 60 * 6, urgency: "high", timeout: TIMEOUT_MS },
      ),
    );
    if (r.vencidas.length > 0) {
      await admin.from("suscripciones_push").delete().in("id", r.vencidas);
    }
    console.info(
      `[push] ${aviso.titulo}: ${r.enviadas} enviada(s), ${r.vencidas.length} vencida(s) borrada(s)${
        r.errores.length ? `, ${r.errores.length} con error (${r.errores.join("; ")})` : ""
      }`,
    );
  } catch (e) {
    console.error("[push] No se pudo avisar al barbero:", e instanceof Error ? e.message : e);
  }
}
