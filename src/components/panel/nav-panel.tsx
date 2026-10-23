"use client";

import {
  BadgePercent,
  CalendarDays,
  Clock,
  House,
  ScanLine,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RUTAS } from "@/lib/rutas";
import { cn } from "@/lib/utils";

type Item = { href: string; etiqueta: string; icono: LucideIcon; exacto?: boolean };

const INICIO: Item = { href: RUTAS.panel, etiqueta: "Inicio", icono: House, exacto: true };
const CLIENTES: Item = { href: RUTAS.clientes, etiqueta: "Clientes", icono: Users };
const ESCANEAR: Item = { href: RUTAS.escanear, etiqueta: "Escanear", icono: ScanLine };
const CAJA: Item = { href: RUTAS.caja, etiqueta: "Caja", icono: Wallet };
const DESCUENTOS: Item = { href: RUTAS.descuentos, etiqueta: "Descuentos", icono: BadgePercent };
const PREMIOS: Item = { href: RUTAS.reglas, etiqueta: "Premios", icono: Settings2 };
const AGENDA: Item = { href: RUTAS.agenda, etiqueta: "Agenda", icono: CalendarDays, exacto: true };
const HORARIOS: Item = { href: RUTAS.horarios, etiqueta: "Horarios", icono: Clock };
/** En la barra del dueño no hay "Horarios": la agenda queda marcada también ahí. */
const AGENDA_Y_HORARIOS: Item = { ...AGENDA, exacto: false };

/** El empleado no ve la caja ni la configuración. */
const itemsLateral = (esDueno: boolean) =>
  esDueno
    ? [INICIO, AGENDA, HORARIOS, CLIENTES, ESCANEAR, CAJA, DESCUENTOS, PREMIOS]
    : [INICIO, AGENDA, HORARIOS, CLIENTES, ESCANEAR];

/**
 * Barra inferior: 5 lugares, con "Escanear" al centro. Para el dueño, la caja y
 * la agenda ocupan los lugares de "Descuentos" y "Premios" (que siguen en el
 * menú lateral y en Inicio). El empleado tiene a mano sus horarios.
 */
const itemsInferior = (esDueno: boolean) =>
  esDueno
    ? [INICIO, AGENDA_Y_HORARIOS, ESCANEAR, CLIENTES, CAJA]
    : [INICIO, AGENDA, ESCANEAR, CLIENTES, HORARIOS];

function useActivo() {
  const path = usePathname();
  return (item: Item) =>
    item.exacto ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
}

/** Navegación lateral (desktop). */
export function NavLateral({ esDueno }: { esDueno: boolean }) {
  const activo = useActivo();
  return (
    <nav aria-label="Secciones del panel" className="grid grid-cols-1 gap-1">
      {itemsLateral(esDueno).map((item) => {
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
                ? "bg-ebano-claro text-oro-claro"
                : "text-arena hover:bg-ebano-claro/60 hover:text-marfil",
            )}
          >
            <Icono className="size-[1.125rem]" strokeWidth={1.75} aria-hidden />
            {item.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barra inferior (mobile), con "Escanear" destacado al centro. */
export function NavInferior({ esDueno }: { esDueno: boolean }) {
  const activo = useActivo();
  const items = itemsInferior(esDueno);
  return (
    <nav
      aria-label="Secciones del panel"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hierro bg-noche/[0.97] lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul
        className={cn(
          "mx-auto grid h-(--alto-nav-inferior) max-w-md",
          items.length === 5 ? "grid-cols-5" : "grid-cols-3",
        )}
      >
        {items.map((item) => {
          const Icono = item.icono;
          const esActivo = activo(item);
          const central = item.href === RUTAS.escanear;
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={esActivo ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                  esActivo ? "text-oro" : "text-arena hover:text-marfil",
                )}
              >
                {esActivo && !central ? (
                  <span aria-hidden className="absolute top-0 h-0.5 w-7 rounded-b-full bg-oro" />
                ) : null}
                {central ? (
                  <span
                    className={cn(
                      "-mt-6 mb-0.5 flex size-14 items-center justify-center rounded-full border-4 border-noche bg-oro text-sobre-neon shadow-suave transition-transform active:scale-95",
                      esActivo && "bg-oro-claro",
                    )}
                  >
                    <Icono className="size-6" aria-hidden />
                  </span>
                ) : (
                  <Icono className="size-[1.375rem]" strokeWidth={1.75} aria-hidden />
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
