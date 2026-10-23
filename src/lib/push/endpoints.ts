/**
 * Servicios push de los navegadores. Una suscripción solo se guarda (y solo se
 * le manda un aviso) si su endpoint es de uno de estos hosts, por https y en el
 * puerto 443: así el servidor nunca hace pedidos a una dirección elegida por
 * alguien (SSRF). La base valida lo mismo (migración 20261025000100).
 *
 *   · Chrome, Edge en Android, Samsung Internet, Opera, Brave: Firebase (FCM)
 *   · Firefox: Mozilla autopush
 *   · Safari (iPhone/iPad 16.4+, Mac): Apple
 *   · Edge en Windows: Windows Push Notification Services (WNS)
 */
const HOSTS_PUSH: RegExp[] = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export const ENDPOINT_PUSH_MAX = 1000;

export function endpointPushValido(endpoint: unknown): boolean {
  if (typeof endpoint !== "string" || endpoint.length > ENDPOINT_PUSH_MAX) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    // El texto original tiene que empezar con el host tal cual (sin trucos de
    // mayúsculas, puntos finales o caracteres que el parser normaliza).
    endpoint.toLowerCase().startsWith(`https://${url.hostname}/`) &&
    HOSTS_PUSH.some((host) => host.test(url.hostname))
  );
}
