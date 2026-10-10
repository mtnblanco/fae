type DatosProgreso = {
  total_cortes: number;
  sellos_actuales: number;
  premios_disponibles: number;
  cortes_necesarios: number | null;
};

export type Progreso = {
  /** Cortes necesarios para un premio (0 si no hay regla). */
  necesarios: number;
  /** Sellos a dibujar en la tarjeta. */
  mostrados: number;
  /** Cortes que faltan para el próximo premio. */
  faltan: number;
  premiosDisponibles: number;
};

/**
 * Cuando el cliente completó la tarjeta y tiene el premio sin canjear, se
 * muestra llena (N/N) en lugar de 0/N. Al canjear vuelve a 0/N.
 */
export function calcularProgreso(d: DatosProgreso): Progreso {
  const necesarios = d.cortes_necesarios ?? 0;
  if (necesarios === 0) return { necesarios: 0, mostrados: 0, faltan: 0, premiosDisponibles: 0 };
  const completa = d.sellos_actuales === 0 && d.premios_disponibles > 0 && d.total_cortes > 0;
  const mostrados = completa ? necesarios : d.sellos_actuales;
  return {
    necesarios,
    mostrados,
    faltan: completa ? 0 : necesarios - d.sellos_actuales,
    premiosDisponibles: d.premios_disponibles,
  };
}

export function textoCortes(n: number): string {
  return n === 1 ? "1 corte" : `${n} cortes`;
}
