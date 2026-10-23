/*
 * Service worker de FaeBarberShop.
 *
 * Solo muestra las notificaciones push de turnos (y abre la agenda al tocarlas).
 * A propósito NO intercepta pedidos ni guarda nada en caché: las páginas tienen
 * datos privados y siempre se piden a la red.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { cuerpo: event.data ? event.data.text() : "" };
  }
  const titulo = aviso.titulo || "FaeBarberShop";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: aviso.cuerpo || "",
      icon: "/iconos/192.png",
      tag: aviso.tag || undefined,
      renotify: Boolean(aviso.tag),
      lang: "es-AR",
      data: { url: aviso.url || "/panel/agenda" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/panel/agenda", self.location.origin);
  // Solo se navega dentro de la app.
  if (destino.origin !== self.location.origin) return;

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const ventana of ventanas) {
        if (new URL(ventana.url).origin === self.location.origin && "focus" in ventana) {
          await ventana.focus();
          if ("navigate" in ventana) await ventana.navigate(destino.href);
          return;
        }
      }
      await self.clients.openWindow(destino.href);
    })(),
  );
});
