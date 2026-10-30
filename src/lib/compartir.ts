/** Archivos generados en el navegador: compartirlos (celular) o descargarlos. */

export function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** En el celular (iPhone sobre todo) se comparte: Instagram, WhatsApp, Mail, Archivos… */
export const puedeCompartir = (archivo: File) =>
  typeof navigator !== "undefined" &&
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files: [archivo] });

/**
 * Abre la hoja de compartir. iOS la abre solo con un toque reciente: llamarla
 * desde un botón, no después de esperar una descarga. Si falla, descarga.
 */
export async function compartir(archivo: File) {
  try {
    await navigator.share({ files: [archivo], title: archivo.name });
  } catch (e) {
    // Cerrar la hoja de compartir no es un error.
    if (e instanceof DOMException && e.name === "AbortError") return;
    descargar(archivo);
  }
}
