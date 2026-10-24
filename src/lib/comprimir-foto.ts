import type { TipoFoto } from "./database.types";
import { FOTO_MAX_BYTES } from "./descuentos";

// La foto se achica en el navegador antes de subirla: una foto de celular
// (3–12 MB, 4000 px) queda en ~100–250 KB. WebP si el navegador sabe
// codificarlo; si no (Safari viejo), JPEG.
const LADO_MAX = 1200;
const OBJETIVO_BYTES = 300 * 1024;
const CALIDADES = [0.8, 0.7, 0.6, 0.5];

export type FotoComprimida = { blob: Blob; tipo: TipoFoto; ancho: number; alto: number };

/** Abre la imagen (incluida HEIC en iPhone: Safari la decodifica) ya rotada según el EXIF. */
async function abrir(
  archivo: Blob,
): Promise<{ fuente: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
      return { fuente: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => bmp.close() };
    } catch {
      // Algunos Safari no abren HEIC con createImageBitmap: probamos con <img>.
    }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return {
      fuente: img,
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      cerrar: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => canvas.toBlob(resolver, tipo, calidad));
}

/**
 * Achica y comprime la foto: lado mayor de hasta 1200 px, WebP (o JPEG) de
 * menos de ~300 KB. Lanza un Error con un mensaje para mostrar si no se puede.
 */
export async function comprimirFoto(archivo: File): Promise<FotoComprimida> {
  let imagen;
  try {
    imagen = await abrir(archivo);
  } catch {
    throw new Error("No pudimos abrir esa imagen. Probá con otra foto (JPG o PNG).");
  }
  try {
    if (!imagen.ancho || !imagen.alto) throw new Error("La imagen está vacía.");
    let escala = Math.min(1, LADO_MAX / Math.max(imagen.ancho, imagen.alto));
    let tipo: TipoFoto | null = null;

    for (let intento = 0; intento < 4; intento++) {
      const ancho = Math.max(1, Math.round(imagen.ancho * escala));
      const alto = Math.max(1, Math.round(imagen.alto * escala));
      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Tu navegador no pudo procesar la foto.");
      // Fondo oscuro por si la imagen tiene transparencia (JPEG no la tiene).
      ctx.fillStyle = "#1d1a15";
      ctx.fillRect(0, 0, ancho, alto);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(imagen.fuente, 0, 0, ancho, alto);

      for (const calidad of CALIDADES) {
        let blob: Blob | null = null;
        if (tipo !== "image/jpeg") {
          blob = await aBlob(canvas, "image/webp", calidad);
          // Si no sabe WebP, el navegador devuelve PNG: de ahí en más, JPEG.
          if (blob?.type === "image/webp") tipo = "image/webp";
          else blob = null;
        }
        if (!blob) {
          tipo = "image/jpeg";
          blob = await aBlob(canvas, "image/jpeg", calidad);
        }
        if (blob && tipo && blob.size <= OBJETIVO_BYTES) return { blob, tipo, ancho, alto };
        if (blob && tipo && calidad === CALIDADES.at(-1) && blob.size <= FOTO_MAX_BYTES) {
          return { blob, tipo, ancho, alto };
        }
      }
      escala *= 0.75;
    }
    throw new Error("La foto es muy pesada. Probá con otra.");
  } finally {
    imagen.cerrar();
  }
}
