"use client";

import { CalendarPlus, IdCard, KeyRound, LogOut, Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/app/acciones";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RUTAS } from "@/lib/rutas";
import { cn } from "@/lib/utils";

/**
 * Las secciones del cliente también están en el menú: en la app instalada no
 * hay botón "atrás" del navegador, así que desde cualquier pantalla se llega a
 * las demás.
 */
const SECCIONES: { href: string; etiqueta: string; icono: LucideIcon }[] = [
  { href: RUTAS.carnet, etiqueta: "Mi carnet", icono: IdCard },
  { href: RUTAS.turnos, etiqueta: "Sacá turno", icono: CalendarPlus },
  { href: RUTAS.cambiarPassword, etiqueta: "Cambiar contraseña", icono: KeyRound },
];

const ITEM = "h-11 cursor-pointer gap-2.5 px-2.5 text-[0.9375rem]";

export function MenuCliente({ nombre }: { nombre: string }) {
  const path = usePathname();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú de la cuenta">
          <Menu className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" collisionPadding={12}>
        <DropdownMenuLabel className="truncate px-2.5 font-normal text-arena">
          {nombre}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SECCIONES.map(({ href, etiqueta, icono: Icono }) => {
          const activo = path === href || (href === RUTAS.turnos && path.startsWith(`${href}/`));
          return (
            <DropdownMenuItem key={href} asChild className={cn(ITEM, activo && "text-oro-claro")}>
              <Link href={href} aria-current={activo ? "page" : undefined}>
                <Icono aria-hidden className={cn(activo && "text-oro-claro")} />
                {etiqueta}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={ITEM} onSelect={() => void cerrarSesion()}>
          <LogOut aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
