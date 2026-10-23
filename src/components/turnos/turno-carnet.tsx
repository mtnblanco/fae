import { miProximoTurno } from "@/lib/datos/turnos";
import { TurnoCliente } from "./turno-cliente";

/**
 * Tarjeta de turnos del carnet: "Tu próximo turno" o "Sacá turno".
 * Si los turnos no estuvieran disponibles (por ejemplo, sin la migración),
 * el carnet se muestra igual, sin esta tarjeta.
 */
export async function TurnoCarnet({ cliente }: { cliente: string }) {
  const turno = await miProximoTurno().catch((e: unknown) => {
    console.error("[turnos] No se pudo cargar el turno del carnet:", e);
    return undefined;
  });
  if (turno === undefined) return null;
  return <TurnoCliente turno={turno} cliente={cliente} />;
}
