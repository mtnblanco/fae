"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  disparador: ReactNode;
  titulo: string;
  descripcion: ReactNode;
  textoConfirmar: string;
  textoCancelar?: string;
  destructiva?: boolean;
  onConfirmar: () => void;
  abierto?: boolean;
  onAbiertoChange?: (abierto: boolean) => void;
};

/** Diálogo de confirmación para acciones destructivas o irreversibles. */
export function Confirmar({
  disparador,
  titulo,
  descripcion,
  textoConfirmar,
  textoCancelar = "Cancelar",
  destructiva = false,
  onConfirmar,
  abierto,
  onAbiertoChange,
}: Props) {
  return (
    <AlertDialog open={abierto} onOpenChange={onAbiertoChange}>
      <AlertDialogTrigger asChild>{disparador}</AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md p-5 data-[size=default]:max-w-md data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-titulo text-2xl font-normal">{titulo}</AlertDialogTitle>
          <AlertDialogDescription className="text-[0.9375rem] leading-relaxed text-arena">
            {descripcion}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="-mx-5 -mb-5 p-4">
          <AlertDialogCancel variant="outline">{textoCancelar}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructiva ? "destructive" : "default"}
            onClick={onConfirmar}
          >
            {textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
