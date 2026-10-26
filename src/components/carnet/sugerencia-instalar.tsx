"use client";

import { Share, SquarePlus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { esModoApp } from "@/hooks/use-modo-app";

const CLAVE = "fae:sugerencia-instalar-cerrada";

const sinSuscripcion = () => () => {};

/** Safari del iPhone (o del iPad), fuera de la app instalada y sin haberla cerrado antes. */
function corresponde(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Chrome, Firefox, Edge, Google y los navegadores de Instagram/Facebook en iOS.
  const otroNavegador = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV/.test(ua);
  if (!ios || otroNavegador || esModoApp()) return false;
  try {
    return localStorage.getItem(CLAVE) === null;
  } catch {
    return true;
  }
}

/**
 * Sugerencia chica para agregar el carnet a la pantalla de inicio del iPhone
 * (en Android, Chrome ya lo ofrece solo). Se cierra y no vuelve a aparecer.
 */
export function SugerenciaInstalar() {
  const mostrar = useSyncExternalStore(sinSuscripcion, corresponde, () => false);
  const [cerrada, setCerrada] = useState(false);
  if (!mostrar || cerrada) return null;

  const cerrar = () => {
    setCerrada(true);
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {
      // Sin almacenamiento (modo privado): se cierra igual, solo por ahora.
    }
  };

  return (
    <aside
      aria-labelledby="titulo-instalar"
      className="relative rounded-xl border border-hierro bg-ebano p-4 pr-12"
    >
      <p id="titulo-instalar" className="font-titulo text-xl leading-tight text-marfil">
        Tené tu carnet como app
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-arena">
        En Safari tocá{" "}
        <span className="inline-flex items-baseline gap-1 text-marfil">
          <Share className="size-4 self-center text-oro" aria-hidden />
          Compartir
        </span>{" "}
        y elegí{" "}
        <span className="inline-flex items-baseline gap-1 text-marfil">
          <SquarePlus className="size-4 self-center text-oro" aria-hidden />
          Agregar a inicio
        </span>
        . Queda a un toque, sin abrir el navegador.
      </p>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Ahora no"
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-lg text-arena transition-colors hover:text-marfil"
      >
        <X className="size-[1.125rem]" aria-hidden />
      </button>
    </aside>
  );
}
