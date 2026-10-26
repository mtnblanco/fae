import { formatearPesos } from "@/lib/dinero";

/** "Corte + barba · $ 14.000" (sin precio, solo el nombre); null si el turno no tiene servicio. */
export function textoServicio(nombre: string | null, precio: number | null): string | null {
  if (!nombre) return null;
  return precio === null ? nombre : `${nombre} · ${formatearPesos(precio)}`;
}
