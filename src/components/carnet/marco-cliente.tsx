import type { ReactNode } from "react";
import { SaltarAlContenido } from "@/components/comunes/saltar-contenido";
import { Logo } from "@/components/marca/logo";
import { RUTAS } from "@/lib/rutas";
import { MenuCliente } from "./menu-cliente";

/**
 * Marco de las pantallas del cliente (carnet y turnos): columna angosta, marca
 * arriba y el menú de la cuenta. Respeta las áreas seguras del iPhone para la
 * app instalada (isla/notch arriba, indicador de inicio abajo, costados en apaisado).
 */
export function MarcoCliente({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh">
      <SaltarAlContenido />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(70%_100%_at_50%_0%,rgb(255_190_30/0.07),transparent)]"
      />
      <header className="pt-seguro">
        <div className="px-seguro mx-auto flex h-16 max-w-md items-center justify-between">
          <Logo href={RUTAS.carnet} tamano="sm" />
          <MenuCliente nombre={nombre} />
        </div>
      </header>
      <main
        id="contenido"
        className="px-seguro mx-auto max-w-md pt-2 pb-[calc(4rem+env(safe-area-inset-bottom))]"
      >
        {children}
      </main>
    </div>
  );
}
