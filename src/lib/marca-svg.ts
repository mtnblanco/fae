/**
 * La "F" de neón como SVG en texto, para íconos, favicon y la imagen OG
 * (next/og no usa el CSS de la app ni carga la fuente Tilt Neon).
 *
 * El trazo es la línea central de la "F" de Tilt Neon (la fuente está dibujada
 * como se dobla un tubo): dos tubos que nacen abajo, uno sube y dobla hacia el
 * travesaño de arriba y el otro dobla hacia el del medio. Se pinta como un cartel
 * real: halo cálido difuso, tubo amarillo y núcleo casi blanco.
 *
 * Coordenadas en unidades de la fuente (1000 por em, y hacia arriba).
 */

/** Tubos de la "F" (línea central, y hacia arriba). */
export const TUBOS_F = ["M125 40V550Q125 635 210 635H428", "M125 40V228Q125 330 215 330H406"];

/** Caja de la "F" con el grosor del tubo (90): x 80–473, y −5–680. */
const CENTRO_X = 276.5;
const CENTRO_Y = 337.5;
const ALTO_F = 685;

export const COLORES_MARCA = {
  noche: "#12100C",
  ebano: "#1D1A15",
  hierro: "#3A3226",
  marfil: "#F1EBDD",
  arena: "#ADA28D",
  oro: "#C9A227",
  neon: "#FFE14D",
  neonNucleo: "#FFF7CC",
  halo: "#FFBE1E",
} as const;

type OpcionesF = {
  /** Qué parte del alto ocupa la "F" (0–1). */
  escala?: number;
  /** Grosor del tubo en unidades de la fuente (90 = el de Tilt Neon). */
  grosor?: number;
  /** Fondo: "noche" (ícono) o "transparente" (para poner sobre otra cosa). */
  fondo?: "noche" | "transparente";
  /** Radio de las esquinas del fondo, en fracción del lado (0 = cuadrado). */
  radio?: number;
  /** Intensidad del halo (0–1). Más bajo en tamaños chicos para que no empaste. */
  halo?: number;
};

/**
 * SVG cuadrado con la "F" encendida.
 * - favicon (16–32 px): tubo grueso, halo corto y casi sin luz de pared.
 * - ícono de app / OG: tubo fino como la fuente, halo completo.
 */
export function svgF({
  escala = 0.64,
  grosor = 90,
  fondo = "noche",
  radio = 0,
  halo = 1,
}: OpcionesF = {}): string {
  const lado = Math.round(ALTO_F / escala);
  const x0 = CENTRO_X - lado / 2;
  const y0 = CENTRO_Y - lado / 2;
  const c = COLORES_MARCA;
  // y hacia abajo para el SVG: espejamos alrededor del centro de la "F".
  const espejo = `matrix(1 0 0 -1 0 ${CENTRO_Y * 2})`;
  const tubos = (color: string, ancho: number, extra = "") =>
    `<g fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round"${extra}>${TUBOS_F.map((d) => `<path d="${d}"/>`).join("")}</g>`;

  // Región del filtro = el cuadro entero (si no, el halo se corta en un rectángulo).
  const region = `filterUnits="userSpaceOnUse" x="${x0}" y="${y0}" width="${lado}" height="${lado}"`;
  const fondoSvg =
    fondo === "noche"
      ? `<rect x="${x0}" y="${y0}" width="${lado}" height="${lado}" rx="${lado * radio}" fill="${c.noche}"/>` +
        `<rect x="${x0}" y="${y0}" width="${lado}" height="${lado}" rx="${lado * radio}" fill="url(#pared)"/>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${lado} ${lado}">
<defs>
<radialGradient id="pared" cx=".5" cy=".46" r=".55"><stop offset="0" stop-color="${c.halo}" stop-opacity="${(0.2 * halo).toFixed(3)}"/><stop offset="1" stop-color="${c.halo}" stop-opacity="0"/></radialGradient>
<filter id="lejos" ${region}><feGaussianBlur stdDeviation="${Math.round(grosor * 0.75)}"/></filter>
<filter id="cerca" ${region}><feGaussianBlur stdDeviation="${Math.round(grosor * 0.22)}"/></filter>
</defs>
${fondoSvg}
<g transform="${espejo}">
${tubos(c.halo, grosor * 1.6, ` opacity="${(0.5 * halo).toFixed(3)}" filter="url(#lejos)"`)}
${tubos(c.neon, grosor * 1.1, ` opacity="${(0.85 * halo).toFixed(3)}" filter="url(#cerca)"`)}
${tubos(c.neon, grosor)}
${tubos(c.neonNucleo, grosor * 0.42)}
</g>
</svg>`;
}

export const dataUri = (svg: string) =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
