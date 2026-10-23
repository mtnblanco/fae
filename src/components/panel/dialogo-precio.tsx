"use client";

import { Pencil } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { guardarPrecio } from "@/app/panel/clientes/acciones";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Campo } from "@/components/comunes/campo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatearPesos, montoParaInput } from "@/lib/dinero";
import { ESTADO_INICIAL } from "@/lib/formularios";

type Cliente = { id: string; nombre: string; precio_habitual: number | null };

function Formulario({ cliente, alGuardar }: { cliente: Cliente; alGuardar: () => void }) {
  const [estado, accion] = useActionState(guardarPrecio, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.estado === "ok") {
      toast.success(estado.mensaje);
      alGuardar();
    }
  }, [estado, alGuardar]);

  return (
    <form action={accion} className="grid grid-cols-1 gap-5" noValidate>
      <input type="hidden" name="id" value={cliente.id} />
      <AvisoFormulario
        tipo="error"
        mensaje={estado.estado === "error" ? estado.mensaje : undefined}
      />
      <Campo
        etiqueta="Precio habitual"
        errores={estado.errores?.precio}
        ayuda="Se precarga al sumarle un corte, y ahí se puede cambiar. Dejalo vacío si no tiene un precio fijo."
      >
        {(a11y) => (
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-lg text-arena"
            >
              $
            </span>
            <Input
              {...a11y}
              name="precio"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Sin precio"
              defaultValue={estado.valores?.precio ?? montoParaInput(cliente.precio_habitual)}
              className="numeros h-12 pl-8 text-lg"
            />
          </div>
        )}
      </Campo>
      <BotonEnviar size="lg" textoCargando="Guardando…">
        Guardar precio
      </BotonEnviar>
    </form>
  );
}

/** Chip con el precio habitual del cliente; el dueño lo toca para editarlo. */
export function DialogoPrecio({ cliente }: { cliente: Cliente }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="numeros inline-flex h-9 items-center gap-1.5 rounded-full border border-hierro px-3.5 text-sm text-marfil transition-colors hover:bg-ebano-claro"
          aria-label={`Editar precio habitual (${
            cliente.precio_habitual === null
              ? "sin precio"
              : formatearPesos(cliente.precio_habitual)
          })`}
        >
          <span className="text-arena">Precio</span>
          {cliente.precio_habitual === null
            ? "sin cargar"
            : formatearPesos(cliente.precio_habitual)}
          <Pencil className="size-3.5 text-arena" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">Precio habitual</DialogTitle>
          <DialogDescription>
            Lo que suele pagar {cliente.nombre.split(" ")[0]} por un corte.
          </DialogDescription>
        </DialogHeader>
        {abierto ? <Formulario cliente={cliente} alGuardar={() => setAbierto(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
