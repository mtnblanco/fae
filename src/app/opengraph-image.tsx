import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { sitio } from "@/config/site";
import { svgPosteDataUri } from "@/lib/marca-svg";

export const alt = `${sitio.nombreCompleto}: club de beneficios`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraph() {
  const gloock = await readFile(join(process.cwd(), "src/assets/Gloock-Regular.ttf"));
  const sellos = [true, true, true, false, false];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "radial-gradient(circle at 15% 0%, #3a2e22 0%, #15110e 60%)",
        color: "#eee6d8",
        fontFamily: "Gloock",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {}
        <img src={svgPosteDataUri()} width={36} height={60} alt="" />
        <span style={{ fontSize: 44 }}>{sitio.nombre}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 112, lineHeight: 1 }}>Cada corte suma.</span>
        <span style={{ fontSize: 34, color: "#b0a493", marginTop: 24 }}>
          Tu carnet de beneficios, en el celular.
        </span>
      </div>
      <div style={{ display: "flex", gap: 22 }}>
        {sellos.map((lleno, i) => (
          <div
            key={i}
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              display: "flex",
              background: lleno
                ? "linear-gradient(135deg, #f1d79b, #c9a15b 45%, #8a6a33)"
                : "rgba(0,0,0,0.35)",
              border: lleno ? "none" : "2px dashed #3a3129",
              boxShadow: lleno ? "0 4px 10px rgba(0,0,0,0.5)" : "none",
            }}
          />
        ))}
      </div>
    </div>,
    { ...size, fonts: [{ name: "Gloock", data: gloock, style: "normal", weight: 400 }] },
  );
}
