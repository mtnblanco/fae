/**
 * Identidad de la barbería. Cambiá estos valores para personalizar la app:
 * se usan en la landing, los títulos, el carnet, el manifest y los mensajes.
 */
export const sitio = {
  nombre: "La Navaja",
  nombreCompleto: "La Navaja Barbería",
  slogan: "Barbería clásica, oficio de siempre.",
  descripcion:
    "Sumá sellos con cada corte y ganá premios. Tu carnet de beneficios de La Navaja Barbería, siempre en el celular.",
  ciudad: "Chivilcoy",
  fundada: 2019,
  /** Opcionales: si quedan vacíos, no se muestran. */
  direccion: "",
  horarios: "",
  instagram: "",
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
