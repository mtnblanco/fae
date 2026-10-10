import type { Metadata } from "next";
import Link from "next/link";
import { BotonSalir } from "@/components/comunes/boton-salir";
import { SaltarAlContenido } from "@/components/comunes/saltar-contenido";
import { Logo } from "@/components/marca/logo";
import { NavInferior, NavLateral } from "@/components/panel/nav-panel";
import { requireBarbero } from "@/lib/auth";
import { RUTAS } from "@/lib/rutas";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s | Panel" },
  robots: { index: false, follow: false },
};

export default async function LayoutPanel({ children }: LayoutProps<"/panel">) {
  const { perfil } = await requireBarbero();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <SaltarAlContenido />

      {/* Lateral (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col self-start border-r border-cuero bg-nogal/60 px-4 py-6 lg:flex">
        <Logo href={RUTAS.panel} tamano="sm" className="px-2" />
        <div className="mt-8 flex-1">
          <NavLateral />
        </div>
        <div className="border-t border-cuero pt-4">
          <p className="truncate px-3 text-sm text-marfil">{perfil.nombre}</p>
          <Link
            href={RUTAS.cambiarPassword}
            className="mt-1 block rounded-md px-3 py-1 text-[0.8125rem] text-arena transition-colors hover:text-marfil"
          >
            Cambiar contraseña
          </Link>
          <BotonSalir className="mt-2 w-full justify-start px-3" />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Barra superior (mobile) */}
        <header className="sticky top-0 z-30 border-b border-cuero bg-espresso/90 backdrop-blur-md lg:hidden">
          <div className="contenedor flex h-14 items-center justify-between">
            <Logo href={RUTAS.panel} tamano="sm" />
            <div className="flex items-center">
              <Link
                href={RUTAS.cambiarPassword}
                className="rounded-md px-2 py-2 text-[0.8125rem] text-arena transition-colors hover:text-marfil"
              >
                {perfil.nombre.split(" ")[0]}
              </Link>
              <BotonSalir compacto />
            </div>
          </div>
        </header>

        <main id="contenido" className="contenedor pb-nav-inferior pt-6 lg:pt-10 lg:pb-16">
          {children}
        </main>
      </div>

      <NavInferior />
    </div>
  );
}
