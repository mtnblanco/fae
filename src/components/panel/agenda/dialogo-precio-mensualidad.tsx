"use client";

import { CalendarCheck, Pencil } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { guardarPrecioMensualidad } from "@/app/panel/agenda/servicios/acciones";
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

type Props = { barberoId: string; precio: number | null; propio: boolean };

function Formulario({
  barberoId,
  precio,
  alGuardar,
}: Omit<Props, "propio"> & { alGuardar: () => void }) {
  const [estado, accion] = useActionState(guardarPrecioMensualidad, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.estado === "ok") {
      toast.success(estado.mensaje);
      alGuardar();
    }
  }, [estado, alGuardar]);

  return (
    <form action={accion} className="grid grid-cols-1 gap-5" noValidate>
      <input type="hidden" name="id" value={barberoId} />
      <AvisoFormulario
        tipo="error"
        mensaje={estado.estado === "error" ? estado.mensaje : undefined}
      />
      <Campo
        etiqueta="Precio de la mensualidad"
        errores={estado.errores?.precio}
        ayuda="Se precarga al cobrarla, y ahí se puede cambiar. Dejalo vacío si no ofrecés mensualidad."
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
              defaultValue={estado.valores?.precio ?? montoParaInput(precio)}
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

/** Tarjeta con el precio de la mensualidad (4 cortes) del barbero; se toca para editarlo. */
export function DialogoPrecioMensualidad({ barberoId, precio, propio }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-hierro bg-ebano p-4 text-left transition-colors hover:bg-ebano-claro"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-oro/15 text-oro">
              <CalendarCheck className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-marfil">Mensualidad: 4 cortes</span>
              <span className="block text-sm text-arena">
                {precio === null
                  ? "Sin precio cargado"
                  : `${formatearPesos(precio)} · se cobra desde la ficha del cliente`}
              </span>
            </span>
          </span>
          <Pencil className="size-4 shrink-0 text-arena" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">Mensualidad</DialogTitle>
          <DialogDescription>
            {propio ? "Lo que cobrás" : "Lo que cobra este barbero"} por 4 cortes pagados por
            adelantado. No vencen y no suman sellos.
          </DialogDescription>
        </DialogHeader>
        {abierto ? (
          <Formulario barberoId={barberoId} precio={precio} alGuardar={() => setAbierto(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
