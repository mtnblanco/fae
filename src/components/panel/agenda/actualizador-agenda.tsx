"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Refresca la agenda sola cuando entra o se cancela un turno:
 *  - en vivo, por Supabase Realtime (respeta el RLS: el empleado recibe solo
 *    los cambios de su agenda);
 *  - al volver a la pestaña o a la app, y cada minuto como respaldo.
 */
export function ActualizadorAgenda({ barberoIds }: { barberoIds: string[] }) {
  const router = useRouter();
  const clave = barberoIds.join(",");

  useEffect(() => {
    const supabase = createClient();
    const ids = new Set(clave.split(","));
    const refrescar = () => router.refresh();
    let canal: RealtimeChannel | null = null;
    let cancelado = false;

    async function escuchar() {
      const { data } = await supabase.auth.getSession();
      if (cancelado || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelado) return;
      canal = supabase
        .channel(`agenda-${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "turnos" }, (payload) => {
          const fila = (payload.new ?? payload.old) as { barbero_id?: string } | null;
          if (!fila?.barbero_id || ids.has(fila.barbero_id)) refrescar();
        })
        .subscribe((estado, error) => {
          if (error) console.warn("[realtime] No se pudo escuchar la agenda:", error.message);
          else if (process.env.NODE_ENV !== "production") console.info("[realtime]", estado);
        });
    }
    void escuchar();

    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") refrescar();
    }, 60_000);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
      if (canal) void supabase.removeChannel(canal);
    };
  }, [clave, router]);

  return null;
}
