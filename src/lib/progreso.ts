/** Una etapa de la tarjeta: al llegar al corte n.º `corte`, se gana `descripcion`. */
export type Etapa = { corte: number; descripcion: string };

/** Premios de una etapa para un cliente (lo calcula la base en `resumen_clientes.premios`). */
export type PremioEtapa = Etapa & { ganados: number; canjeados: number; disponibles: number };

/** Un premio que el cliente puede canjear ahora (`cantidad` ≥ 1). */
export type PremioDisponible = Etapa & { cantidad: number };

type DatosProgreso = {
  total_cortes: number;
  premios_disponibles: number;
  cortes_necesarios: number | null;
  descripcion_premio?: string | null;
  etapas?: Etapa[] | null;
  premios?: PremioEtapa[] | null;
};

export type Progreso = {
  /** Largo de la tarjeta: el corte de la última etapa (0 si no hay regla). */
  necesarios: number;
  /** Sellos a dibujar en la tarjeta. */
  mostrados: number;
  /** Cortes que faltan para la próxima etapa (0 con la tarjeta completa). */
  faltan: number;
  /** La próxima etapa a ganar en esta tarjeta (null si está completa o no hay regla). */
  proxima: Etapa | null;
  etapas: Etapa[];
  premiosDisponibles: number;
  /** Premios para canjear, en el orden de las etapas. */
  disponibles: PremioDisponible[];
};

/** Etapas de la regla; si faltan (datos viejos), "cada N cortes" es una sola etapa. */
export function etapasDe(d: {
  etapas?: Etapa[] | null;
  cortes_necesarios: number | null;
  descripcion_premio?: string | null;
}): Etapa[] {
  if (d.etapas?.length) return [...d.etapas].sort((a, b) => a.corte - b.corte);
  if (!d.cortes_necesarios) return [];
  return [{ corte: d.cortes_necesarios, descripcion: d.descripcion_premio ?? "Premio" }];
}

/**
 * Progreso de la tarjeta. Los sellos son `cortes % L`; cuando el cliente
 * completó la tarjeta y todavía no canjeó el premio de la última etapa, se
 * muestra llena (L/L) en lugar de 0/L. Al canjearlo vuelve a 0/L.
 */
export function calcularProgreso(d: DatosProgreso): Progreso {
  const etapas = etapasDe(d);
  const necesarios = etapas.at(-1)?.corte ?? 0;
  const disponibles = (d.premios ?? [])
    .filter((p) => p.disponibles > 0)
    .map(({ corte, descripcion, disponibles: cantidad }) => ({ corte, descripcion, cantidad }));

  if (necesarios === 0) {
    return {
      necesarios: 0,
      mostrados: 0,
      faltan: 0,
      proxima: null,
      etapas: [],
      premiosDisponibles: 0,
      disponibles: [],
    };
  }

  const total = Math.max(0, d.total_cortes);
  const resto = total % necesarios;
  const ultimaDisponible = d.premios
    ? (d.premios.find((p) => p.corte === necesarios)?.disponibles ?? 0) > 0
    : d.premios_disponibles > 0;
  const completa = resto === 0 && total > 0 && ultimaDisponible;
  const mostrados = completa ? necesarios : resto;
  const proxima = completa ? null : (etapas.find((e) => e.corte > mostrados) ?? null);

  return {
    necesarios,
    mostrados,
    faltan: proxima ? proxima.corte - mostrados : 0,
    proxima,
    etapas,
    premiosDisponibles: d.premios_disponibles,
    disponibles,
  };
}

/** La etapa que ganó el corte número `total` (el último sumado), si ganó alguna. */
export function etapaAlcanzada(etapas: Etapa[], total: number): Etapa | null {
  const largo = etapas.at(-1)?.corte ?? 0;
  if (largo === 0 || total <= 0) return null;
  const posicion = ((total - 1) % largo) + 1;
  return etapas.find((e) => e.corte === posicion) ?? null;
}

export function textoCortes(n: number): string {
  return n === 1 ? "1 corte" : `${n} cortes`;
}

/** "Corte gratis" → "corte gratis" (para usar en medio de una frase). "50% OFF" queda igual. */
export function enFrase(texto: string): string {
  const t = texto.trim();
  // Solo si la segunda letra es minúscula: no rompe siglas ni "OFF".
  return /^\p{Lu}\p{Ll}/u.test(t) ? t.charAt(0).toLocaleLowerCase("es") + t.slice(1) : t;
}

/** "4.º", "10.º" */
export function ordinal(n: number): string {
  return `${n}.º`;
}

/** Resumen de la regla en una línea: "Cada 5 cortes: X" o "4.º: X · 7.º: Y". */
export function resumenRegla(etapas: Etapa[]): string {
  if (etapas.length === 0) return "";
  if (etapas.length === 1) {
    const [e] = etapas as [Etapa];
    return e.corte === 1
      ? `Cada corte: ${e.descripcion}`
      : `Cada ${e.corte} cortes: ${e.descripcion}`;
  }
  return etapas.map((e) => `${ordinal(e.corte)} corte: ${e.descripcion}`).join(" · ");
}
