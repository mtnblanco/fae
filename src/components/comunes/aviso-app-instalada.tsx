"use client";

import { Smartphone } from "lucide-react";
import { useModoApp } from "@/hooks/use-modo-app";

/**
 * En la app instalada del iPhone la sesión no es la de Safari: la primera vez
 * hay que entrar de nuevo. Lo decimos para que no parezca un error, y para que
 * sepan que es una sola vez.
 */
export function AvisoAppInstalada() {
  const modoApp = useModoApp();
  if (!modoApp) return null;
  return (
    <p className="mb-6 flex items-start gap-2.5 rounded-lg border border-oro/30 bg-oro/10 px-3.5 py-3 text-sm leading-snug text-marfil">
      <Smartphone className="mt-px size-4 shrink-0 text-oro" aria-hidden />
      <span>
        Entrá una vez acá en la app y{" "}
        <span className="text-oro-claro">queda la sesión iniciada</span>: la próxima vez abre
        directo tu carnet.
      </span>
    </p>
  );
}
