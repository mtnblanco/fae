import { ZONA_HORARIA } from "@/config/site";

const fmtHora = new Intl.DateTimeFormat("es-AR", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: ZONA_HORARIA,
});

export function saludo(ahora: Date = new Date()): string {
  const hora = Number(fmtHora.format(ahora));
  if (hora >= 5 && hora < 13) return "Buen día";
  if (hora >= 13 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}
