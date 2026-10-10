"use client";

import { KeyRound, LogOut, Menu } from "lucide-react";
import Link from "next/link";
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

export function MenuCliente({ nombre }: { nombre: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú de la cuenta">
          <Menu className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-arena">{nombre}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="h-10 cursor-pointer">
          <Link href={RUTAS.cambiarPassword}>
            <KeyRound aria-hidden />
            Cambiar contraseña
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="h-10 cursor-pointer" onSelect={() => void cerrarSesion()}>
          <LogOut aria-hidden />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
