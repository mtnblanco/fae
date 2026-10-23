"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { borrarSuscripcionPush, guardarSuscripcionPush } from "@/app/panel/agenda/acciones";
import { Button } from "@/components/ui/button";

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Estado =
  "cargando" | "sin-soporte" | "iphone-sin-instalar" | "bloqueadas" | "apagadas" | "activadas";

function claveABytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}

const esIphone = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const estaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registro() {
  return (
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }))
  );
}

/**
 * "Activar notificaciones" para que el barbero se entere cuando le reservan o
 * le cancelan un turno. Sin claves VAPID configuradas, no se muestra.
 */
export function ActivarNotificaciones() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    async function revisar() {
      const soporta =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!soporta) {
        // En iPhone, las notificaciones existen solo con la web agregada a inicio.
        return esIphone() && !estaInstalada() ? "iphone-sin-instalar" : "sin-soporte";
      }
      if (Notification.permission === "denied") return "bloqueadas";
      const reg = await registro();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return "apagadas";
      // Re-sincroniza: si en este celular entró otro barbero, la suscripción pasa a ser suya.
      void guardarSuscripcionPush(sub.toJSON());
      return "activadas";
    }
    revisar()
      .then((e) => {
        if (!cancelado) setEstado(e);
      })
      .catch(() => {
        if (!cancelado) setEstado("sin-soporte");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function activar() {
    setTrabajando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueadas" : "apagadas");
        return;
      }
      const reg = await registro();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: claveABytes(CLAVE_PUBLICA),
        }));
      const r = await guardarSuscripcionPush(sub.toJSON());
      if (!r.ok) throw new Error(r.error);
      setEstado("activadas");
      toast.success("Listo: te vamos a avisar cuando te reserven o cancelen un turno.");
    } catch (e) {
      console.error("[push]", e);
      toast.error("No se pudieron activar las notificaciones en este navegador.");
    } finally {
      setTrabajando(false);
    }
  }

  async function desactivar() {
    setTrabajando(true);
    try {
      const sub = await (await registro()).pushManager.getSubscription();
      if (sub) {
        await borrarSuscripcionPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("apagadas");
    } finally {
      setTrabajando(false);
    }
  }

  if (!CLAVE_PUBLICA || estado === "cargando" || estado === "sin-soporte") return null;

  if (estado === "iphone-sin-instalar") {
    return (
      <p className="text-[0.8125rem] leading-relaxed text-arena">
        En iPhone, primero agregá la web a la pantalla de inicio (Compartir → Agregar a inicio).
      </p>
    );
  }

  if (estado === "bloqueadas") {
    return (
      <p className="flex items-center gap-2 text-[0.8125rem] text-arena">
        <BellOff className="size-4 shrink-0" aria-hidden />
        Las notificaciones están bloqueadas para esta web en el navegador.
      </p>
    );
  }

  if (estado === "activadas") {
    return (
      <p className="flex min-h-11 items-center gap-2 text-[0.8125rem] text-arena">
        <Bell className="size-4 shrink-0 text-oro" aria-hidden />
        Avisos de turnos activados.
        <button
          type="button"
          onClick={desactivar}
          disabled={trabajando}
          className="-my-2 rounded-md px-1 py-2 text-arena underline underline-offset-4 hover:text-marfil"
        >
          Desactivar
        </button>
      </p>
    );
  }

  return (
    <Button variant="oro" className="h-12 w-full sm:w-auto" onClick={activar} disabled={trabajando}>
      {trabajando ? <Loader2 className="animate-spin" aria-hidden /> : <Bell aria-hidden />}
      Activar notificaciones
    </Button>
  );
}
