/**
 * Identidad de la barbería. Cambiá estos valores para personalizar la app:
 * se usan en la landing, los títulos, el carnet, el manifest y los mensajes.
 */
export const sitio = {
  nombre: "FaeBarberShop",
  nombreCompleto: "FaeBarberShop",
  slogan: "Barbería clásica, oficio de siempre.",
  descripcion:
    "Sumá sellos con cada corte y ganá premios. Tu carnet de beneficios de FaeBarberShop, siempre en el celular.",
  ciudad: "La Plata",
  /** Opcionales: si quedan vacíos, no se muestran. */
  sedes: ["Calle 16 entre 40 y 41", "Calle 45 entre 28 y 29"],
  horarios: "",
  /** Usuario de Instagram, sin "@". */
  instagram: "faebarbershop",
  /** WhatsApp para turnos, en formato internacional y solo dígitos. */
  whatsapp: "5491144463270",
} as const;

/** URL pública (sin barra final). En Vercel se completa con NEXT_PUBLIC_SITE_URL. */
export function urlDelSitio(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
