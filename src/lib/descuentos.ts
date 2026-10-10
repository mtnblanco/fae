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
