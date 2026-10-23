import type { Metadata } from "next";
import { MenuCliente } from "@/components/carnet/menu-cliente";
import { SaltarAlContenido } from "@/components/comunes/saltar-contenido";
import { Logo } from "@/components/marca/logo";
import { requireCliente } from "@/lib/auth";
import { RUTAS } from "@/lib/rutas";

export const metadata: Metadata = { title: "Sacá turno", robots: { index: false, follow: false } };

export default async function LayoutTurnos({ children }: LayoutProps<"/turnos">) {
  const { perfil } = await requireCliente();
  return (
    <div className="relative isolate min-h-dvh">
      <SaltarAlContenido />
      <header className="mx-auto box-content flex h-16 max-w-md items-center justify-between px-(--gutter) pt-[env(safe-area-inset-top)]">
        <Logo href={RUTAS.carnet} tamano="sm" />
        <MenuCliente nombre={perfil.nombre} />
      </header>
      <main id="contenido" className="mx-auto max-w-md px-(--gutter) pt-2 pb-16">
        {children}
      </main>
    </div>
  );
}
