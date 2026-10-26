"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { guardarServicio } from "@/app/panel/agenda/servicios/acciones";
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
import { Textarea } from "@/components/ui/textarea";
import type { Servicio } from "@/lib/database.types";
import { montoParaInput } from "@/lib/dinero";
import { ESTADO_INICIAL } from "@/lib/formularios";

function Formulario({
  barberoId,
  servicio,
  alGuardar,
}: {
  barberoId: string;
  servicio?: Servicio;
  alGuardar: () => void;
}) {
  const [estado, accion] = useActionState(guardarServicio, ESTADO_INICIAL);
  const v = estado.valores;

  useEffect(() => {
    if (estado.estado === "ok") {
      toast.success(estado.mensaje);
      alGuardar();
    }
  }, [estado, alGuardar]);

  return (
    <form action={accion} className="grid grid-cols-1 gap-5" noValidate>
      <input type="hidden" name="barbero_id" value={barberoId} />
      {servicio ? <input type="hidden" name="id" value={servicio.id} /> : null}
      <AvisoFormulario
        tipo="error"
        mensaje={estado.estado === "error" ? estado.mensaje : undefined}
      />
      <Campo etiqueta="Servicio" errores={estado.errores?.nombre}>
        {(a11y) => (
          <Input
            {...a11y}
            name="nombre"
            maxLength={60}
            autoComplete="off"
            placeholder="Corte + barba"
            defaultValue={v?.nombre ?? servicio?.nombre}
            required
          />
        )}
      </Campo>
      <Campo
        etiqueta="Precio"
        errores={estado.errores?.precio}
        ayuda="Lo ven tus clientes al sacar turno con vos."
      >
        {(a11y) => (
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base font-semibold text-arena"
            >
              $
            </span>
            <Input
              {...a11y}
              name="precio"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="8.000"
              defaultValue={v?.precio ?? montoParaInput(servicio?.precio)}
              className="numeros pl-8"
              required
            />
          </div>
        )}
      </Campo>
      <Campo
        etiqueta="Descripción (opcional)"
        errores={estado.errores?.descripcion}
        ayuda="Una línea: qué incluye."
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            name="descripcion"
            rows={2}
            maxLength={140}
            placeholder="Corte a tijera o máquina, con lavado."
            defaultValue={v?.descripcion ?? servicio?.descripcion ?? ""}
          />
        )}
      </Campo>
      <BotonEnviar size="lg" textoCargando="Guardando…">
        {servicio ? "Guardar cambios" : "Agregar servicio"}
      </BotonEnviar>
    </form>
  );
}

/** Alta o edición de un servicio, en un diálogo. */
export function DialogoServicio({
  barberoId,
  servicio,
  disparador,
}: {
  barberoId: string;
  servicio?: Servicio;
  disparador: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">
            {servicio ? "Editar servicio" : "Nuevo servicio"}
          </DialogTitle>
          <DialogDescription>
            {servicio
              ? "Los turnos ya reservados mantienen el precio que tenían."
              : "Lo que ofrecés y cuánto cobrás. La duración la marca tu horario."}
          </DialogDescription>
        </DialogHeader>
        {abierto ? (
          <Formulario
            barberoId={barberoId}
            servicio={servicio}
            alGuardar={() => setAbierto(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
