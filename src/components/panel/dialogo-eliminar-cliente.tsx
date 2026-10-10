"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { eliminarCliente } from "@/app/panel/clientes/acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const normalizar = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Baja de un cliente: hay que escribir su nombre para confirmar. */
export function DialogoEliminarCliente({ cliente }: { cliente: { id: string; nombre: string } }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pendiente, startTransition] = useTransition();
  const id = useId();
  const coincide = normalizar(texto) === normalizar(cliente.nombre);

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) setTexto("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden />
          Eliminar cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">
            ¿Eliminar a {cliente.nombre}?
          </DialogTitle>
          <DialogDescription>
            Se borran su cuenta, sus cortes y sus premios. No se puede deshacer. Si solo se olvidó
            la contraseña, usá “Resetear contraseña”.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-1 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!coincide) return;
            startTransition(async () => {
              const r = await eliminarCliente(cliente.id);
              // Si sale bien, la acción redirige a la lista.
              if (r && !r.ok) toast.error(r.error);
            });
          }}
        >
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor={id}>
              Escribí <span className="font-semibold text-marfil">{cliente.nombre}</span> para
              confirmar
            </Label>
            <Input
              id={id}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={!coincide || pendiente}>
              {pendiente ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Trash2 aria-hidden />
              )}
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
