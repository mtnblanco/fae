import { sitio } from "@/config/site";
import { formatearTelefono } from "@/lib/telefono";

type Credenciales = { nombre: string; telefono: string; password: string; url: string };

const primerNombre = (nombre: string) => nombre.split(" ")[0] ?? nombre;

/** Mensaje para pasarle al cliente sus datos de acceso por WhatsApp. */
export function mensajeAlta({ nombre, telefono, password, url }: Credenciales): string {
  return [
    `¡Hola ${primerNombre(nombre)}! Ya tenés tu carnet de beneficios de ${sitio.nombreCompleto}.`,
    "",
    `Entrá en ${url}/login`,
    `Teléfono: ${formatearTelefono(telefono)}`,
    `Contraseña: ${password}`,
    "",
    "La primera vez te va a pedir que elijas una contraseña tuya. ¡Nos vemos en la próxima!",
  ].join("\n");
}

export function mensajeReseteo({ nombre, telefono, password, url }: Credenciales): string {
  return [
    `Hola ${primerNombre(nombre)}, te generé una contraseña nueva para tu carnet de ${sitio.nombreCompleto}.`,
    "",
    `Entrá en ${url}/login`,
    `Teléfono: ${formatearTelefono(telefono)}`,
    `Contraseña temporal: ${password}`,
    "",
    "Al entrar te va a pedir que elijas una nueva.",
  ].join("\n");
}
