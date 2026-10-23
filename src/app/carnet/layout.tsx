import type { Metadata } from "next";
import { SaltarAlContenido } from "@/components/comunes/saltar-contenido";
import { MenuCliente } from "@/components/carnet/menu-cliente";
import { Logo } from "@/components/marca/logo";
import { requireCliente } from "@/lib/auth";
import { RUTAS } from "@/lib/rutas";

export const metadata: Metadata = { title: "Mi carnet", robots: { index: false, follow: false } };

export default async function LayoutCarnet({ children }: LayoutProps<"/carnet">) {
  const { perfil } = await requireCliente();
  return (
    <div className="relative isolate min-h-dvh">
      <SaltarAlContenido />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(70%_100%_at_50%_0%,rgb(255_190_30/0.07),transparent)]"
      />
      <header className="mx-auto flex h-16 max-w-md items-center justify-between px-(--gutter)">
        <Logo href={RUTAS.carnet} tamano="sm" />
        <MenuCliente nombre={perfil.nombre} />
      </header>
      <main id="contenido" className="pb-seguro mx-auto max-w-md px-(--gutter) pt-2 pb-16">
        {children}
      </main>
    </div>
  );
}
