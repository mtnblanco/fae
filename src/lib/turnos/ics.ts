/**
 * Archivo .ics para agendar el turno en el calendario del celular, con un
 * recordatorio 2 horas antes (lo dispara el teléfono, sin mails ni costos).
 */

const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const escapar = (texto: string) =>
  texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    // \r suelto también corta la línea en algunos calendarios (inyección de campos).
    .replace(/\r\n|\r|\n/g, "\\n");

export function archivoIcs(turno: {
  id: string;
  inicio: Date;
  fin: Date;
  titulo: string;
  lugar: string;
  descripcion: string;
  ahora?: Date;
}): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FaeBarberShop//Turnos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:turno-${turno.id}@faebarbershop`,
    `DTSTAMP:${utc(turno.ahora ?? new Date())}`,
    `DTSTART:${utc(turno.inicio)}`,
    `DTEND:${utc(turno.fin)}`,
    `SUMMARY:${escapar(turno.titulo)}`,
    `LOCATION:${escapar(turno.lugar)}`,
    `DESCRIPTION:${escapar(turno.descripcion)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapar(turno.titulo)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
