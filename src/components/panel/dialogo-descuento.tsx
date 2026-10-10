"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { guardarDescuento } from "@/app/panel/descuentos/acciones";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Descuento } from "@/lib/database.types";
import { ESTADO_INICIAL } from "@/lib/formularios";

function Formulario({
  descuento,
  hoy,
  alGuardar,
}: {
  descuento?: Descuento;
  hoy: string;
  alGuardar: () => void;
}) {
  const [estado, accion] = useActionState(guardarDescuento, ESTADO_INICIAL);
  const v = estado.valores;

  useEffect(() => {
    if (estado.estado === "ok") {
      toast.success(estado.mensaje);
      alGuardar();
    }
  }, [estado, alGuardar]);

  return (
    <form action={accion} className="grid grid-cols-1 gap-5" noValidate>
      {descuento ? <input type="hidden" name="id" value={descuento.id} /> : null}
      <AvisoFormulario
        tipo="error"
        mensaje={estado.estado === "error" ? estado.mensaje : undefined}
      />
      <Campo etiqueta="Comercio" errores={estado.errores?.comercio}>
        {(a11y) => (
          <Input
            {...a11y}
            name="comercio"
            placeholder="Café del Centro"
            defaultValue={v?.comercio ?? descuento?.comercio}
            required
          />
        )}
      </Campo>
      <Campo
        etiqueta="Beneficio"
        errores={estado.errores?.descripcion}
        ayuda="Qué obtiene el cliente y cómo lo usa."
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            name="descripcion"
            rows={3}
            maxLength={280}
            placeholder="15% off mostrando el carnet."
            defaultValue={v?.descripcion ?? descuento?.descripcion}
            required
          />
        )}
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Desde" errores={estado.errores?.vigente_desde}>
          {(a11y) => (
            <Input
              {...a11y}
              type="date"
              name="vigente_desde"
              defaultValue={v?.vigente_desde ?? descuento?.vigente_desde.slice(0, 10) ?? hoy}
              required
            />
          )}
        </Campo>
        <Campo etiqueta="Hasta (opcional)" errores={estado.errores?.vigente_hasta}>
          {(a11y) => (
            <Input
              {...a11y}
              type="date"
              name="vigente_hasta"
              defaultValue={v?.vigente_hasta ?? descuento?.vigente_hasta?.slice(0, 10) ?? ""}
            />
          )}
        </Campo>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-cuero px-4 py-3">
        <Label htmlFor="descuento-activo" className="grid grid-cols-1 gap-0.5">
          <span className="text-marfil">Activo</span>
          <span className="text-[0.8125rem] font-normal text-arena">
            Si lo pausás, los clientes dejan de verlo.
          </span>
        </Label>
        <Switch id="descuento-activo" name="activo" defaultChecked={descuento?.activo ?? true} />
      </div>
      <BotonEnviar size="lg" textoCargando="Guardando…">
        {descuento ? "Guardar cambios" : "Crear descuento"}
      </BotonEnviar>
    </form>
  );
}

export function DialogoDescuento({
  descuento,
  hoy,
  disparador,
}: {
  descuento?: Descuento;
  hoy: string;
  disparador: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">
            {descuento ? "Editar descuento" : "Nuevo descuento"}
          </DialogTitle>
          <DialogDescription>
            Un beneficio en un comercio amigo para los clientes de la barbería.
          </DialogDescription>
        </DialogHeader>
        {abierto ? (
          <Formulario descuento={descuento} hoy={hoy} alGuardar={() => setAbierto(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
