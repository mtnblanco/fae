/**
 * Lógica de envío de notificaciones push, sin dependencias del servidor (así
 * se puede probar). El envío real con `web-push` está en `servidor.ts`.
 */

export type Suscripcion = { id: string; endpoint: string; p256dh: string; auth: string };

export type Aviso = {
  titulo: string;
  cuerpo: string;
  /** A dónde lleva el toque en la notificación. */
  url: string;
  /** Avisos con el mismo tag se reemplazan en vez de apilarse. */
  tag?: string;
};

/** Error de la librería de envío: interesa el código HTTP del servicio push. */
type ErrorEnvio = { statusCode?: number; message?: string };

export type Enviar = (s: Suscripcion, cuerpo: string) => Promise<unknown>;

/** 404 y 410: la suscripción ya no existe (desinstaló la app, revocó el permiso…). */
export const suscripcionVencida = (error: unknown) => {
  const codigo = (error as ErrorEnvio | null)?.statusCode;
  return codigo === 404 || codigo === 410;
};

/**
 * Manda el aviso a todas las suscripciones. Nunca lanza: devuelve cuántas
 * salieron y qué suscripciones vencidas hay que borrar.
 */
export async function enviarATodas(suscripciones: Suscripcion[], aviso: Aviso, enviar: Enviar) {
  const cuerpo = JSON.stringify(aviso);
  const resultados = await Promise.allSettled(suscripciones.map((s) => enviar(s, cuerpo)));
  const vencidas: string[] = [];
  let enviadas = 0;
  const errores: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") enviadas++;
    else if (suscripcionVencida(r.reason)) vencidas.push(suscripciones[i]!.id);
    else errores.push((r.reason as ErrorEnvio | null)?.message ?? String(r.reason));
  });
  return { enviadas, vencidas, errores };
}
