"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (public/sw.js) en el panel: solo muestra las
 * notificaciones de turnos; no guarda páginas en caché.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((e: unknown) => console.warn("[sw] No se pudo registrar:", e));
  }, []);
  return null;
}
