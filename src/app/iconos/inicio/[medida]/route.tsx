import { ImageResponse } from "next/og";
import { MEDIDAS_INICIO } from "@/config/pantallas-inicio";
import { COLORES_MARCA, dataUri, svgF } from "@/lib/marca-svg";

export const dynamicParams = false;

export function generateStaticParams() {
  return MEDIDAS_INICIO.map((medida) => ({ medida }));
}

/** Pantalla de arranque del iPhone: la "F" encendida al centro, sobre la noche. */
export async function GET(_req: Request, { params }: RouteContext<"/iconos/inicio/[medida]">) {
  const { medida } = await params;
  const partes = /^(\d+)x(\d+)\.png$/.exec(medida);
  if (!partes || !MEDIDAS_INICIO.includes(medida)) {
    return new Response("No encontrado", { status: 404 });
  }
  const ancho = Number(partes[1]);
  const alto = Number(partes[2]);
  const lado = Math.round(ancho * 0.56);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORES_MARCA.noche,
        // La luz que el cartel derrama, sobre toda la pantalla (sin bordes de cuadro).
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255, 190, 30, 0.13), rgba(255, 190, 30, 0) ${Math.round(ancho * 0.45)}px)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og necesita <img> */}
      <img
        src={dataUri(svgF({ escala: 0.42, fondo: "transparente" }))}
        width={lado}
        height={lado}
        alt=""
      />
    </div>,
    {
      width: ancho,
      height: alto,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
