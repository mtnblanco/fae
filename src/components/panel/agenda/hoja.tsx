"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Hoja de acciones: en el celular sale desde abajo (al alcance del pulgar). */
export function Hoja({
  abierta,
  onAbiertaChange,
  titulo,
  descripcion,
  children,
}: {
  abierta: boolean;
  onAbiertaChange: (abierta: boolean) => void;
  titulo: ReactNode;
  descripcion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog open={abierta} onOpenChange={onAbiertaChange}>
      <DialogContent className="top-auto bottom-0 left-0 max-h-[88dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-5 data-open:zoom-in-100 data-open:slide-in-from-bottom-8">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="font-titulo text-2xl font-normal">{titulo}</DialogTitle>
          {descripcion ? (
            <DialogDescription className="text-[0.9375rem] text-arena">
              {descripcion}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">Acciones</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
