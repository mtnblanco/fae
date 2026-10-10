/**
 * Normaliza lo que escribe el barbero en el buscador para compararlo con la
 * columna `busqueda` de la base (nombre sin tildes en minúscula + teléfono).
 * Devuelve null si no queda nada para buscar.
 */
export function normalizarBusqueda(texto: string): string | null {
  const limpio = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim();
  if (!limpio) return null;
  // Si es un teléfono ("2346 40-11"), se busca solo por los dígitos.
  if (/^[\d\s-]+$/.test(limpio)) return limpio.replace(/\D/g, "") || null;
  return limpio.replace(/-/g, " ").replace(/\s+/g, " ").slice(0, 60);
}
