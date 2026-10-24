import type { TipoFoto } from "./database.types";

export type EstadoDescuento = "vigente" | "programado" | "vencido" | "pausado";

/** Estado de un descuento según su vigencia (fechas "YYYY-MM-DD") y si está activo. */
export function estadoDescuento(
  d: { activo: boolean; vigente_desde: string; vigente_hasta: string | null },
  hoy: string,
): EstadoDescuento {
  if (!d.activo) return "pausado";
  if (d.vigente_desde.slice(0, 10) > hoy) return "programado";
  if (d.vigente_hasta && d.vigente_hasta.slice(0, 10) < hoy) return "vencido";
  return "vigente";
}

export const ETIQUETA_ESTADO: Record<EstadoDescuento, string> = {
  vigente: "Visible para clientes",
  programado: "Programado",
  vencido: "Vencido",
  pausado: "Pausado",
};

// ─── Foto del local ─────────────────────────────────────────────────────────
// Los mismos límites que valida la base (guardar_foto_descuento).
export const FOTO_MAX_BYTES = 400 * 1024;
export const TIPOS_FOTO = ["image/webp", "image/jpeg"] as const satisfies readonly TipoFoto[];

/** El formato real de la imagen según sus primeros bytes (no según lo que diga el navegador). */
export function tipoFotoPorBytes(bytes: Uint8Array): TipoFoto | null {
  const ascii = (desde: number, texto: string) =>
    [...texto].every((c, i) => bytes[desde + i] === c.charCodeAt(0));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

/** URL de la foto del local: la versión en la URL deja cachearla para siempre. */
export function urlFotoDescuento(id: string, version: string): string {
  const v = Date.parse(version);
  return `/descuentos/${id}/foto?v=${Number.isNaN(v) ? encodeURIComponent(version) : v}`;
}
