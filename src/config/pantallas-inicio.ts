/**
 * Pantallas de arranque de la app instalada en iPhone (apple-touch-startup-image).
 * iOS solo usa la imagen cuyo `media` coincide exacto con el equipo; sin ninguna,
 * la app arranca con un destello blanco. Medidas en puntos (CSS) y densidad.
 * Un iPhone que no esté en la lista arranca igual, con el destello.
 */
const PANTALLAS = [
  { ancho: 320, alto: 568, densidad: 2 }, // SE (1.ª)
  { ancho: 375, alto: 667, densidad: 2 }, // SE (2.ª y 3.ª), 6/7/8
  { ancho: 414, alto: 736, densidad: 3 }, // 6/7/8 Plus
  { ancho: 375, alto: 812, densidad: 3 }, // X, XS, 11 Pro, 12/13 mini
  { ancho: 414, alto: 896, densidad: 2 }, // XR, 11
  { ancho: 414, alto: 896, densidad: 3 }, // XS Max, 11 Pro Max
  { ancho: 390, alto: 844, densidad: 3 }, // 12, 13, 14, 16e
  { ancho: 428, alto: 926, densidad: 3 }, // 12/13 Pro Max, 14 Plus
  { ancho: 393, alto: 852, densidad: 3 }, // 14 Pro, 15, 15 Pro, 16
  { ancho: 430, alto: 932, densidad: 3 }, // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  { ancho: 402, alto: 874, densidad: 3 }, // 16 Pro, 17, 17 Pro
  { ancho: 440, alto: 956, densidad: 3 }, // 16 Pro Max, 17 Pro Max
  { ancho: 420, alto: 912, densidad: 3 }, // Air
] as const;

const enPixeles = (p: (typeof PANTALLAS)[number]) =>
  `${p.ancho * p.densidad}x${p.alto * p.densidad}`;

/** Nombres de archivo servidos por /iconos/inicio/[medida] (por ejemplo "1170x2532.png"). */
export const MEDIDAS_INICIO = [...new Set(PANTALLAS.map((p) => `${enPixeles(p)}.png`))];

/** Para `metadata.appleWebApp.startupImage` (solo vertical: la app se usa así). */
export const IMAGENES_INICIO = PANTALLAS.map((p) => ({
  url: `/iconos/inicio/${enPixeles(p)}.png`,
  media: `(device-width: ${p.ancho}px) and (device-height: ${p.alto}px) and (-webkit-device-pixel-ratio: ${p.densidad}) and (orientation: portrait)`,
}));
