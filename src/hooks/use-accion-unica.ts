"use client";

import { useCallback, useRef, useTransition } from "react";
import { nuevoUuid } from "@/lib/uuid";

/**
 * Ejecuta una acción una sola vez aunque se toque el botón varias veces:
 *  - ignora toques mientras hay una en curso (candado síncrono, antes del re-render);
 *  - manda la misma clave de idempotencia (`solicitudId`) hasta que la acción termina,
 *    así un reintento no duplica en la base.
 */
export function useAccionUnica() {
  const [pendiente, startTransition] = useTransition();
  const enCurso = useRef(false);
  const solicitud = useRef<string | null>(null);

  const ejecutar = useCallback((fn: (solicitudId: string) => Promise<void>) => {
    if (enCurso.current) return;
    enCurso.current = true;
    solicitud.current ??= nuevoUuid();
    const id = solicitud.current;
    startTransition(async () => {
      try {
        await fn(id);
        solicitud.current = null;
      } finally {
        enCurso.current = false;
      }
    });
  }, []);

  return { pendiente, ejecutar };
}
