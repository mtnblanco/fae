import { requireDueno } from "@/lib/auth";
import { todosLosMovimientos } from "@/lib/datos/panel";
import {
  armarInforme,
  FORMATOS_INFORME,
  type FormatoInforme,
  informeCsv,
  leerRangoInforme,
  nombreArchivoInforme,
} from "@/lib/informe";
import { informePdf } from "@/lib/informe-pdf";

const TIPOS: Record<FormatoInforme, string> = {
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
};

/**
 * Informe de la caja para el contador (solo el dueño), en PDF o CSV para Excel.
 * Lo pide el formulario de la caja con fetch y lo comparte o lo descarga.
 */
export async function GET(request: Request) {
  await requireDueno();
  const params = new URL(request.url).searchParams;
  const rango = leerRangoInforme(params.get("desde"), params.get("hasta"));
  const formato = params.get("formato") ?? "pdf";
  if (!rango || !(FORMATOS_INFORME as readonly string[]).includes(formato)) {
    return new Response("El período elegido no es válido.", { status: 400 });
  }

  const informe = armarInforme(rango, await todosLosMovimientos(rango));
  const f = formato as FormatoInforme;
  const cuerpo = f === "pdf" ? await informePdf(informe) : informeCsv(informe);
  return new Response(cuerpo as BodyInit, {
    headers: {
      "Content-Type": TIPOS[f],
      "Content-Disposition": `attachment; filename="${nombreArchivoInforme(rango, f)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
