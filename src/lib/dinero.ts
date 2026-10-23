/** Montos en pesos argentinos: formato "$ 8.500" y lectura de lo que tipea el barbero. */

/** Máximo que acepta la base (numeric(12, 2) con un check de 0 a 9.999.999). */
export const MONTO_MAX = 9_999_999;

const NBSP = "\u00a0";

export const MENSAJE_MONTO_INVALIDO = "Revisá el monto: escribilo como 8.000 o 8.500,50.";

const fmtEntero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const fmtCentavos = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const tieneCentavos = (n: number) => Math.round(n * 100) % 100 !== 0;

/** 8000 → "$ 8.000"; 8500.5 → "$ 8.500,50". El espacio no se corta de línea. */
export function formatearPesos(monto: number): string {
  const texto = tieneCentavos(monto) ? fmtCentavos.format(monto) : fmtEntero.format(monto);
  return `$${NBSP}${texto}`;
}

/** Para precargar un input: 8000 → "8.000"; 8500.5 → "8.500,50"; null → "". */
export function montoParaInput(monto: number | null | undefined): string {
  if (monto === null || monto === undefined) return "";
  return tieneCentavos(monto) ? fmtCentavos.format(monto) : fmtEntero.format(monto);
}

export type MontoLeido = { ok: true; monto: number | null } | { ok: false };

/**
 * Lee un monto como lo escribe alguien en Argentina: "8.000", "8000", "8.500,50",
 * "$ 8.000", "8500.5" (punto decimal del teclado numérico). Vacío = sin monto.
 *
 * Regla para el punto: si separa grupos de 3 dígitos ("8.000", "1.250.000") es
 * separador de miles; si no ("8500.5"), es la coma decimal.
 */
export function parsearMonto(texto: string): MontoLeido {
  const limpio = texto.replace(/[\s $]/g, "");
  if (limpio === "") return { ok: true, monto: null };

  let normalizado: string;
  if (limpio.includes(",")) {
    // Con coma: la coma es decimal y los puntos son de miles.
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpio)) return { ok: false };
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    normalizado = limpio.replace(/\./g, "");
  } else if (/^\d+(\.\d{1,2})?$/.test(limpio)) {
    normalizado = limpio;
  } else {
    return { ok: false };
  }

  const monto = Math.round(Number(normalizado) * 100) / 100;
  if (!Number.isFinite(monto) || monto < 0 || monto > MONTO_MAX) return { ok: false };
  return { ok: true, monto };
}

/** PostgREST devuelve numeric como número; el emulador local, como texto. */
export function aNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}
