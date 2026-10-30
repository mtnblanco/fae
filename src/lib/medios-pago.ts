import type { MedioPago } from "@/lib/database.types";

/** Cómo pagó el cliente. Mismo orden en toda la app (y en el informe del contador). */
export const MEDIOS_PAGO = ["efectivo", "transferencia"] as const satisfies readonly MedioPago[];

export const ETIQUETAS_MEDIO: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
};

export const MENSAJE_FALTA_MEDIO = "Marcá si pagó en efectivo o por transferencia.";

/** Etiqueta del medio de pago, o "Sin dato" (cortes viejos, o sin cobro). */
export const etiquetaMedio = (medio: MedioPago | null) =>
  medio ? ETIQUETAS_MEDIO[medio] : "Sin dato";
