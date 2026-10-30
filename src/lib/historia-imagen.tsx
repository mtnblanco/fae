import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { sitio } from "@/config/site";
import { distribucion, HISTORIA, recortar, textosHistoria } from "@/lib/historia";
import { COLORES_MARCA as C } from "@/lib/marca-svg";
import { RUTAS } from "@/lib/rutas";

// next/og no aplica el CSS de la app: los brillos del manual van escritos acá, en px.
const BRILLO_TEXTO = [
  "0 0 3px rgba(255,247,204,0.9)",
  "0 0 12px rgba(255,225,77,0.9)",
  "0 0 34px rgba(255,190,30,0.55)",
  "0 0 80px rgba(255,190,30,0.3)",
].join(", ");

const fuente = (archivo: string) => readFile(join(process.cwd(), "src/assets", archivo));

type Datos = {
  fecha: string;
  hoy: string;
  barbero: string;
  /** Horarios libres ("10:30"), en orden. Al menos uno. */
  horarios: string[];
  /** Dominio para el pie ("faebarbershop.com"). */
  sitio: string;
};

/** La historia de Instagram (PNG 1080 × 1920) con los horarios libres de un día. */
export async function imagenHistoria(datos: Datos): Promise<ImageResponse> {
  const { horarios } = datos;
  const [gloock, tiltNeon, regular, semibold] = await Promise.all([
    fuente("Gloock-Regular.ttf"),
    fuente("TiltNeon-Regular.ttf"),
    fuente("InstrumentSans-Regular.ttf"),
    fuente("InstrumentSans-SemiBold.ttf"),
  ]);

  const t = textosHistoria(datos.fecha, datos.hoy, horarios.length, datos.barbero);
  // Alto que queda para los horarios entre el título y el pie (medido en la imagen).
  const d = distribucion(horarios.length, t.dosLineas ? 500 : 650);
  const { visibles, resto } = recortar(horarios);
  const pastillas = resto > 0 ? [...visibles, `y ${resto} más`] : visibles;
  // 888 = ancho útil (1080 menos 96 de cada lado).
  const anchoPastilla =
    d.tipo === "pocos" ? 560 : Math.floor((888 - d.hueco * (d.columnas - 1)) / d.columnas);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Arriba y abajo quedan libres: ahí Instagram pone el perfil y la barra de respuesta.
        padding: "250px 96px 340px",
        background: `radial-gradient(70% 38% at 50% 30%, rgba(255,190,30,0.16), rgba(255,190,30,0) 70%), ${C.noche}`,
        color: C.marfil,
        fontFamily: "Instrument Sans",
      }}
    >
      <span style={{ fontFamily: "Tilt Neon", fontSize: 52, color: C.marfil }}>{sitio.nombre}</span>

      <div
        style={{
          marginTop: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
        }}
      >
        <span
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: C.oro,
          }}
        >
          {t.dia}
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: t.dosLineas ? "column" : "row",
            alignItems: "center",
            fontFamily: "Gloock",
            fontSize: t.dosLineas ? 140 : 150,
            lineHeight: t.dosLineas ? 1.08 : 1,
            color: C.marfil,
          }}
        >
          <span>{t.titulo.antes}</span>
          <span
            style={{
              color: C.neonNucleo,
              textShadow: BRILLO_TEXTO,
              marginLeft: t.dosLineas ? 0 : 36,
            }}
          >
            {t.titulo.luz}
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 40, color: C.arena }}>
          <span>con&nbsp;</span>
          <span style={{ color: C.marfil }}>{t.barbero}</span>
        </div>
      </div>

      {/* Los horarios ocupan el espacio del medio, centrados. */}
      <div
        style={{
          flexGrow: 1,
          width: "100%",
          display: "flex",
          flexDirection: d.tipo === "pocos" ? "column" : "row",
          flexWrap: "wrap",
          alignItems: "center",
          alignContent: "center",
          justifyContent: "center",
          gap: d.tipo === "pocos" ? 48 : d.hueco,
          padding: "60px 0",
        }}
      >
        {pastillas.map((h, i) => (
          <div
            key={i}
            style={{
              width: anchoPastilla,
              height: d.alto,
              borderRadius: d.alto / 2,
              border: `3px solid ${C.oro}`,
              background: "rgba(201,162,39,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: h.startsWith("y ") ? Math.round(d.letra * 0.8) : d.letra,
              fontWeight: 600,
              color: C.marfil,
            }}
          >
            {h}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <span style={{ fontSize: 42, fontWeight: 600, color: C.marfil }}>Reservá desde la app</span>
        <span style={{ fontSize: 36, color: C.arena }}>
          {datos.sitio}
          {RUTAS.turnos} · @{sitio.instagram}
        </span>
      </div>
    </div>,
    {
      width: HISTORIA.ancho,
      height: HISTORIA.alto,
      fonts: [
        { name: "Gloock", data: gloock, weight: 400 },
        { name: "Tilt Neon", data: tiltNeon, weight: 400 },
        { name: "Instrument Sans", data: regular, weight: 400 },
        { name: "Instrument Sans", data: semibold, weight: 600 },
      ],
    },
  );
}
