import { sitio } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { aInstante } from "@/lib/turnos/fechas";
import { archivoIcs } from "@/lib/turnos/ics";

/** Descarga el próximo turno del cliente como .ics (con recordatorio 2 h antes). */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mi_proximo_turno");
  const turno = data?.[0];
  if (!turno) return new Response("No tenés turnos reservados.", { status: 404 });

  const ics = archivoIcs({
    id: turno.id,
    inicio: aInstante(turno.inicio),
    fin: aInstante(turno.fin),
    titulo: `Turno en ${sitio.nombre}`,
    lugar: `${sitio.sedes[0] ?? ""}, ${sitio.ciudad}`,
    descripcion: `Con ${turno.barbero_nombre}. Si no podés venir, cancelalo desde la web o avisá por WhatsApp.`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="turno-faebarbershop.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
