/** Totales de la caja a partir de las filas por barbero que devuelve `facturacion`. */

type FilaCaja = {
  cortes: number;
  cortes_sin_monto: number;
  total: number;
  servicios: number;
  efectivo: number;
  transferencia: number;
  mensualidades: number;
  cortes_mensuales: number;
};

export type TotalesCaja = {
  cortes: number;
  cortesSinMonto: number;
  /** Servicios sin cliente registrado. */
  servicios: number;
  /** Mensualidades cobradas (su plata está en el total). */
  mensualidades: number;
  /** Cortes hechos con mensualidad (no suman plata). */
  cortesMensuales: number;
  total: number;
  efectivo: number;
  transferencia: number;
  /** Cobrado sin medio de pago (cortes cargados antes de que se pidiera). */
  sinMedio: number;
  /** Promedio por cobro: cortes con monto, servicios y mensualidades (null si no hay ninguno). */
  promedio: number | null;
};

// Se suma en centavos para no arrastrar errores de punto flotante.
const centavos = (n: number) => Math.round(n * 100);

export function sumarCaja(filas: FilaCaja[]): TotalesCaja {
  const sumar = (campo: (f: FilaCaja) => number) => filas.reduce((n, f) => n + campo(f), 0);
  const cortes = sumar((f) => f.cortes);
  const cortesSinMonto = sumar((f) => f.cortes_sin_monto);
  const servicios = sumar((f) => f.servicios);
  const mensualidades = sumar((f) => f.mensualidades);
  const total = sumar((f) => centavos(f.total));
  const efectivo = sumar((f) => centavos(f.efectivo));
  const transferencia = sumar((f) => centavos(f.transferencia));
  const conMonto = cortes - cortesSinMonto + servicios + mensualidades;
  return {
    cortes,
    cortesSinMonto,
    servicios,
    mensualidades,
    cortesMensuales: sumar((f) => f.cortes_mensuales),
    total: total / 100,
    efectivo: efectivo / 100,
    transferencia: transferencia / 100,
    sinMedio: Math.max(0, total - efectivo - transferencia) / 100,
    promedio: conMonto > 0 ? Math.round(total / conMonto) / 100 : null,
  };
}
