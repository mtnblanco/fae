/**
 * Informe de la caja para el contador: cada cobro con su día, barbero,
 * servicio, medio de pago y monto, y los totales por barbero y por medio.
 * Lo comparten el PDF y el CSV (Excel).
 */
import { ZONA_HORARIA } from "@/config/site";
import type { MedioPago, MovimientoCaja } from "@/lib/database.types";
import { etiquetaMedio } from "@/lib/medios-pago";
import type { Rango } from "@/lib/periodos";

export const FORMATOS_INFORME = ["pdf", "csv"] as const;
export type FormatoInforme = (typeof FORMATOS_INFORME)[number];

/** Mismo tope que facturacion() y movimientos_caja() en la base. */
export const DIAS_MAX_INFORME = 3700;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const aDia = (iso: string) => {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(anio!, mes! - 1, dia!));
  return d.toISOString().slice(0, 10) === iso ? d : null;
};

/** Lee y valida el período pedido ("YYYY-MM-DD", ambos inclusive). */
export function leerRangoInforme(desde: string | null, hasta: string | null): Rango | null {
  if (!desde || !hasta || !ISO.test(desde) || !ISO.test(hasta)) return null;
  const d = aDia(desde);
  const h = aDia(hasta);
  if (!d || !h || h < d) return null;
  if ((h.getTime() - d.getTime()) / 86_400_000 > DIAS_MAX_INFORME) return null;
  return { desde, hasta };
}

const fmtDia = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});
const fmtHora = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZONA_HORARIA,
});

/** "2026-10-05T18:30:00Z" → "05/10/2026" (hora argentina). */
export const diaInforme = (instante: string) => fmtDia.format(new Date(instante));
/** "2026-10-05T18:30:00Z" → "15:30" (hora argentina). */
export const horaInforme = (instante: string) => fmtHora.format(new Date(instante));
/** "2026-10-05" → "05/10/2026". */
export const diaISOInforme = (iso: string) => iso.split("-").reverse().join("/");

export type FilaInforme = {
  dia: string;
  hora: string;
  barbero: string;
  servicio: string;
  /** "Cliente registrado" o "Sin cliente registrado". */
  tipo: string;
  medio: string;
  /** Null = corte cargado sin monto. */
  monto: number | null;
};

export type TotalesInforme = {
  cantidad: number;
  total: number;
  efectivo: number;
  transferencia: number;
  /** Cobrado sin medio de pago (cortes cargados antes de que se pidiera). */
  sinDato: number;
};

export type Informe = {
  rango: Rango;
  filas: FilaInforme[];
  porBarbero: (TotalesInforme & { barbero: string })[];
  totales: TotalesInforme;
};

const vacio = (): TotalesInforme => ({
  cantidad: 0,
  total: 0,
  efectivo: 0,
  transferencia: 0,
  sinDato: 0,
});

// Se suma en centavos para no arrastrar errores de punto flotante.
function sumar(t: TotalesInforme, monto: number | null, medio: MedioPago | null) {
  t.cantidad += 1;
  if (monto === null) return;
  const c = Math.round(monto * 100);
  t.total += c;
  if (medio === "efectivo") t.efectivo += c;
  else if (medio === "transferencia") t.transferencia += c;
  else t.sinDato += c;
}

const aPesos = (t: TotalesInforme): TotalesInforme => ({
  cantidad: t.cantidad,
  total: t.total / 100,
  efectivo: t.efectivo / 100,
  transferencia: t.transferencia / 100,
  sinDato: t.sinDato / 100,
});

/** Arma el informe a partir de los movimientos (del más viejo al más nuevo). */
export function armarInforme(rango: Rango, movimientos: MovimientoCaja[]): Informe {
  const totales = vacio();
  const porBarbero = new Map<string, TotalesInforme>();
  const filas = movimientos.map((m): FilaInforme => {
    const barbero = m.barbero_nombre ?? "Sin barbero";
    sumar(totales, m.monto, m.medio_pago);
    if (!porBarbero.has(barbero)) porBarbero.set(barbero, vacio());
    sumar(porBarbero.get(barbero)!, m.monto, m.medio_pago);
    return {
      dia: diaInforme(m.fecha),
      hora: horaInforme(m.fecha),
      barbero,
      servicio: m.servicio_nombre ?? "Corte",
      tipo: m.tipo === "servicio" ? "Sin cliente registrado" : "Cliente registrado",
      medio:
        m.tipo === "mensual"
          ? "Mensualidad"
          : m.monto === null
            ? "Sin cobro"
            : etiquetaMedio(m.medio_pago),
      monto: m.monto,
    };
  });
  return {
    rango,
    filas,
    porBarbero: [...porBarbero]
      .map(([barbero, t]) => ({ barbero, ...aPesos(t) }))
      .sort((a, b) => b.total - a.total || a.barbero.localeCompare(b.barbero, "es")),
    totales: aPesos(totales),
  };
}

/** "caja-2026-10-01-al-2026-10-31.pdf" */
export const nombreArchivoInforme = ({ desde, hasta }: Rango, formato: FormatoInforme) =>
  `caja-${desde}${desde === hasta ? "" : `-al-${hasta}`}.${formato}`;

// ─── CSV ────────────────────────────────────────────────────────────────────
// Para Excel en español: separador ";", coma decimal y BOM (para las tildes).

const celda = (valor: string) =>
  /[";\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
const numeroCsv = (n: number) => n.toFixed(2).replace(".", ",");

export function informeCsv(informe: Informe): string {
  const lineas = [
    ["Fecha", "Hora", "Barbero", "Servicio", "Cliente", "Medio de pago", "Monto"],
    ...informe.filas.map((f) => [
      f.dia,
      f.hora,
      f.barbero,
      f.servicio,
      f.tipo,
      f.medio,
      f.monto === null ? "" : numeroCsv(f.monto),
    ]),
  ];
  return `﻿${lineas.map((l) => l.map(celda).join(";")).join("\r\n")}\r\n`;
}
