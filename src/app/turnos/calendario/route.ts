import { NextResponse } from "next/server";
import { sitio } from "@/config/site";
import { RUTAS } from "@/lib/rutas";
import { createClient } from "@/lib/supabase/server";
import { aInstante } from "@/lib/turnos/fechas";
import { archivoIcs } from "@/lib/turnos/ics";

/** iPhone y iPad (el iPad que se anuncia como Mac recibe `attachment`, como la Mac). */
const ES_IOS = /iPhone|iPad|iPod/;

/**
 * Descarga el próximo turno del cliente como .ics (con recordatorio 2 h antes).
 *
 * Los links llegan acá sin el atributo `download`, navegando en la misma
 * ventana (también en la app instalada, que así conserva la sesión):
 * - iPhone: con `inline`, iOS abre la hoja "Agregar al calendario" encima de la
 *   app. Con `attachment` (o con `download`) lo manda a Descargas.
 * - Android y escritorio: con `attachment` se descarga y se abre con el calendario.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mi_proximo_turno");
  const turno = data?.[0];
  // Sin turno (lo cancelaron, o se venció la sesión): de vuelta a la app, no a
  // un texto suelto, que en la app instalada no tiene botón para volver.
  if (!turno) return NextResponse.redirect(new URL(RUTAS.turnos, request.url));

  const ics = archivoIcs({
    id: turno.id,
    inicio: aInstante(turno.inicio),
    fin: aInstante(turno.fin),
    titulo: `Turno en ${sitio.nombre}`,
    lugar: `${sitio.sedes[0] ?? ""}, ${sitio.ciudad}`,
    descripcion: `${turno.servicio_nombre ? `${turno.servicio_nombre}, con` : "Con"} ${turno.barbero_nombre}. Si no podés venir, cancelalo desde la web o avisá por WhatsApp.`,
  });
  const ios = ES_IOS.test(request.headers.get("user-agent") ?? "");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${ios ? "inline" : "attachment"}; filename="turno-faebarbershop.ics"`,
      "Cache-Control": "private, no-store",
      Vary: "User-Agent",
    },
  });
}
