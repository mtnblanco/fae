import { urlDelSitio } from "@/config/site";
import { requireBarbero } from "@/lib/auth";
import { horariosLibres, listarBarberos } from "@/lib/datos/turnos";
import { hoyISO } from "@/lib/fechas";
import { nombreArchivoHistoria } from "@/lib/historia";
import { imagenHistoria } from "@/lib/historia-imagen";
import { fechaTurno, horaTurno, sumarDias } from "@/lib/turnos/fechas";
import { TURNOS } from "@/lib/turnos/reglas";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const texto = (mensaje: string, status: number) =>
  new Response(mensaje, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * Imagen para historia de Instagram (1080 × 1920) con los horarios libres de
 * un barbero en un día: los mismos que ve el cliente al sacar turno. El
 * empleado, la suya; el dueño, la de cualquier barbero (?barbero=).
 */
export async function GET(request: Request) {
  const { userId, perfil } = await requireBarbero();
  const params = new URL(request.url).searchParams;
  const hoy = hoyISO();
  const fecha = params.get("fecha") ?? hoy;
  if (!FECHA.test(fecha) || fecha < hoy || fecha > sumarDias(hoy, TURNOS.diasVentana - 1)) {
    return texto("Elegí un día entre hoy y los próximos 13.", 400);
  }

  const pedido = params.get("barbero") ?? userId;
  const barbero = perfil.es_dueno
    ? (await listarBarberos()).find((b) => b.id === pedido)
    : pedido === userId
      ? { id: userId, nombre: perfil.nombre }
      : undefined;
  if (!barbero) return texto("Ese barbero no existe.", 404);

  const horarios = (await horariosLibres(barbero.id))
    .filter((h) => fechaTurno(h.inicio) === fecha)
    .map((h) => horaTurno(h.inicio));
  if (horarios.length === 0) return texto("No quedan horarios libres ese día.", 404);

  const imagen = await imagenHistoria({
    fecha,
    hoy,
    barbero: barbero.nombre,
    horarios,
    sitio: new URL(urlDelSitio()).host.replace(/^www\./, ""),
  });

  imagen.headers.set(
    "Content-Disposition",
    `attachment; filename="${nombreArchivoHistoria(barbero.nombre, fecha)}"`,
  );
  imagen.headers.set("Cache-Control", "private, no-store");
  return imagen;
}
