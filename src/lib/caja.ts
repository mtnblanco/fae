/** Totales de la caja a partir de las filas por barbero que devuelve `facturacion`. */

type FilaCaja = { cortes: number; cortes_sin_monto: number; total: number };

export type TotalesCaja = {
  cortes: number;
  cortesSinMonto: number;
  total: number;
  /** Promedio por corte con monto (null si no hay ninguno). */
  promedio: number | null;
};

export function sumarCaja(filas: FilaCaja[]): TotalesCaja {
  const cortes = filas.reduce((n, f) => n + f.cortes, 0);
  const cortesSinMonto = filas.reduce((n, f) => n + f.cortes_sin_monto, 0);
  // Se suma en centavos para no arrastrar errores de punto flotante.
  const total = filas.reduce((n, f) => n + Math.round(f.total * 100), 0) / 100;
  const conMonto = cortes - cortesSinMonto;
  return {
    cortes,
    cortesSinMonto,
    total,
    promedio: conMonto > 0 ? Math.round((total / conMonto) * 100) / 100 : null,
  };
}
