"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Refresca el carnet cuando el barbero suma un corte o canjea un premio:
 *  - en vivo, por Supabase Realtime (respeta el RLS: solo llegan SUS registros);
 *  - y como respaldo, cada vez que el cliente vuelve a la pestaña o a la app.
 */
export function ActualizadorCarnet({
  clienteId,
  cortesIds,
}: {
  clienteId: string;
  cortesIds: string[];
}) {
  const router = useRouter();
  const idsClave = cortesIds.join(",");

  useEffect(() => {
    const supabase = createClient();
    const propios = new Set(idsClave.split(","));
    const refrescar = () => router.refresh();
    let canal: RealtimeChannel | null = null;
    let cancelado = false;

    async function escuchar() {
      // Realtime aplica el RLS con el token del usuario: hay que pasárselo ANTES de
      // suscribirse. Si no, se une como "anon" y no recibe (ni puede filtrar) nada.
      const { data } = await supabase.auth.getSession();
      if (cancelado || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelado) return;

      // Nombre único por montaje: evita choques si el componente se monta dos veces.
      canal = supabase
        .channel(`carnet-${clienteId}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "cortes",
            filter: `cliente_id=eq.${clienteId}`,
          },
          refrescar,
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "canjes",
            filter: `cliente_id=eq.${clienteId}`,
          },
          refrescar,
        )
        // Los DELETE no se pueden filtrar por columna: solo traen el id. Refrescamos si es uno nuestro.
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "cortes" },
          (payload) => {
            const id = (payload.old as { id?: string } | null)?.id;
            if (id && propios.has(id)) refrescar();
          },
        )
        .subscribe((estado, error) => {
          if (error)
            console.warn("[realtime] No se pudo escuchar los cambios del carnet:", error.message);
          else if (process.env.NODE_ENV !== "production") console.info("[realtime]", estado);
        });
    }
    void escuchar();

    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alVolver);
      if (canal) void supabase.removeChannel(canal);
    };
  }, [clienteId, idsClave, router]);

  return null;
}
