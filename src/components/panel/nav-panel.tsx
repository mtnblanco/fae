"use client";

import { BadgePercent, House, ScanLine, Settings2, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUTAS } from "@/lib/rutas";
import { cn } from "@/lib/utils";

type Item = { href: string; etiqueta: string; icono: LucideIcon; exacto?: boolean };

const ITEMS: Item[] = [
  { href: RUTAS.panel, etiqueta: "Inicio", icono: House, exacto: true },
  { href: RUTAS.clientes, etiqueta: "Clientes", icono: Users },
  { href: RUTAS.escanear, etiqueta: "Escanear", icono: ScanLine },
  { href: RUTAS.descuentos, etiqueta: "Descuentos", icono: BadgePercent },
  { href: RUTAS.reglas, etiqueta: "Premios", icono: Settings2 },
];

function useActivo() {
  const path = usePathname();
  return (item: Item) =>
    item.exacto ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
}

/** Navegación lateral (desktop). */
export function NavLateral() {
  const activo = useActivo();
  return (
    <nav aria-label="Secciones del panel" className="grid grid-cols-1 gap-1">
      {ITEMS.map((item) => {
        const Icono = item.icono;
        const esActivo = activo(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={esActivo ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-[0.9375rem] transition-colors",
              esActivo
                ? "bg-nogal-claro text-marfil"
                : "text-arena hover:bg-nogal-claro/60 hover:text-marfil",
            )}
          >
            <Icono className={cn("size-[1.125rem]", esActivo && "text-bronce")} aria-hidden />
            {item.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior (mobile), con "Escanear" destacado al centro. */
export function NavInferior() {
  const activo = useActivo();
  return (
    <nav
      aria-label="Secciones del panel"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cuero bg-espresso/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-(--alto-nav-inferior) max-w-md grid-cols-5">
        {ITEMS.map((item) => {
          const Icono = item.icono;
          const esActivo = activo(item);
          const central = item.href === RUTAS.escanear;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={esActivo ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                  esActivo ? "text-marfil" : "text-arena hover:text-marfil",
                )}
              >
                {central ? (
                  <span
                    className={cn(
                      "-mt-6 mb-0.5 flex size-14 items-center justify-center rounded-full border-4 border-espresso bg-bronce text-primary-foreground shadow-bronce transition-transform active:scale-95",
                    )}
                  >
                    <Icono className="size-6" aria-hidden />
                  </span>
                ) : (
                  <Icono className={cn("size-[1.375rem]", esActivo && "text-bronce")} aria-hidden />
                )}
                <span>{item.etiqueta}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
