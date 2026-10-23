/**
 * Períodos de la caja ("este mes", "hoy"…) como rangos de fechas argentinas
 * "YYYY-MM-DD", ambos inclusive.
 */

export const PERIODOS = ["hoy", "semana", "mes", "mes-anterior", "anio"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const ETIQUETAS_PERIODO: Record<Periodo, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
  "mes-anterior": "Mes anterior",
  anio: "Este año",
};

export const esPeriodo = (valor: string | undefined): valor is Periodo =>
  (PERIODOS as readonly string[]).includes(valor ?? "");

export type Rango = { desde: string; hasta: string };

const aISO = (d: Date) => d.toISOString().slice(0, 10);

function aFecha(iso: string): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(anio!, mes! - 1, dia!));
}

/** Rango de un período, a partir de la fecha de hoy en Argentina ("YYYY-MM-DD"). */
export function rangoPeriodo(periodo: Periodo, hoy: string): Rango {
  const d = aFecha(hoy);
  const anio = d.getUTCFullYear();
  const mes = d.getUTCMonth();
  switch (periodo) {
    case "hoy":
      return { desde: hoy, hasta: hoy };
    case "semana": {
      // La semana arranca el lunes.
      const desdeLunes = (d.getUTCDay() + 6) % 7;
      return {
        desde: aISO(new Date(Date.UTC(anio, mes, d.getUTCDate() - desdeLunes))),
        hasta: hoy,
      };
    }
    case "mes":
      return { desde: aISO(new Date(Date.UTC(anio, mes, 1))), hasta: hoy };
    case "mes-anterior":
      return {
        desde: aISO(new Date(Date.UTC(anio, mes - 1, 1))),
        hasta: aISO(new Date(Date.UTC(anio, mes, 0))),
      };
    case "anio":
      return { desde: `${anio}-01-01`, hasta: hoy };
  }
}

/**
 * Límites del rango como instantes (para filtrar timestamps): desde las 00:00
 * del primer día hasta las 00:00 del día siguiente al último (exclusivo), en
 * hora argentina (UTC−3, sin horario de verano desde 2009).
 */
export function limitesRango({ desde, hasta }: Rango): { inicio: string; fin: string } {
  const siguiente = aFecha(hasta);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return { inicio: `${desde}T00:00:00-03:00`, fin: `${aISO(siguiente)}T00:00:00-03:00` };
}
