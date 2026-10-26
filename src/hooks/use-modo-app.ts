"use client";

import { useSyncExternalStore } from "react";

const CONSULTA = "(display-mode: standalone)";

function suscribir(avisar: () => void) {
  const mq = window.matchMedia(CONSULTA);
  mq.addEventListener("change", avisar);
  return () => mq.removeEventListener("change", avisar);
}

/** ¿Se abrió como app instalada (desde la pantalla de inicio)? */
export function esModoApp(): boolean {
  return (
    window.matchMedia(CONSULTA).matches ||
    // iPhone: Safari marca así la app agregada a la pantalla de inicio.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * `true` en la app instalada. En el servidor (y en la primera pasada de la
 * hidratación) da `false`, así que lo que dependa de esto aparece después.
 */
export function useModoApp(): boolean {
  return useSyncExternalStore(suscribir, esModoApp, () => false);
}
