import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { sitio } from "@/config/site";
import { COLORES_MARCA as C, dataUri, svgF } from "@/lib/marca-svg";

export const alt = `${sitio.nombreCompleto}: club de beneficios`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// next/og no aplica el CSS de la app: los brillos del manual van escritos acá, en px.
const BRILLO_TEXTO = [
  `0 0 2px rgba(255,247,204,0.9)`,
  `0 0 9px rgba(255,225,77,0.9)`,
  `0 0 24px rgba(255,190,30,0.55)`,
  `0 0 60px rgba(255,190,30,0.3)`,
].join(", ");
const BRILLO_SELLO = `0 0 6px rgba(255,225,77,0.55), 0 0 22px rgba(255,190,30,0.45)`;

export default async function OpenGraph() {
  const [gloock, tiltNeon] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/Gloock-Regular.ttf")),
    readFile(join(process.cwd(), "src/assets/TiltNeon-Regular.ttf")),
  ]);
  const sellos = [true, true, true, false, false];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 80px",
        background: `radial-gradient(70% 80% at 30% 45%, rgba(255,190,30,0.12), rgba(255,190,30,0) 70%), ${C.noche}`,
        color: C.marfil,
        fontFamily: "Gloock",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src={dataUri(svgF({ fondo: "transparente", escala: 0.62 }))}
          width={92}
          height={92}
          alt=""
          style={{ margin: "-14px -18px -14px -22px" }}
        />
        <span style={{ fontFamily: "Tilt Neon", fontSize: 46, color: C.marfil }}>
          {sitio.nombre}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 120, lineHeight: 1, letterSpacing: -2 }}>
          <span>Cada corte&nbsp;</span>
          <span style={{ color: C.neonNucleo, textShadow: BRILLO_TEXTO }}>suma.</span>
        </div>
        <span style={{ fontSize: 34, color: C.arena, marginTop: 28 }}>
          Tu carnet de beneficios, en el celular.
        </span>
      </div>
      <div style={{ display: "flex", gap: 22 }}>
        {sellos.map((lleno, i) => (
          <div
            key={i}
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              display: "flex",
              background: lleno
                ? `radial-gradient(circle at 50% 38%, ${C.neonNucleo}, ${C.neon} 62%)`
                : "transparent",
              border: lleno ? "none" : `2px dashed #5A4F3D`,
              boxShadow: lleno ? BRILLO_SELLO : "none",
            }}
          />
        ))}
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Gloock", data: gloock, style: "normal", weight: 400 },
        { name: "Tilt Neon", data: tiltNeon, style: "normal", weight: 400 },
      ],
    },
  );
}
