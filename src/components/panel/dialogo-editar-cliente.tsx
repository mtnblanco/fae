"use client";

import { Pencil } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { editarCliente } from "@/app/panel/clientes/acciones";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Campo } from "@/components/comunes/campo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/formularios";
import { formatearTelefono } from "@/lib/telefono";

function Formulario({
  cliente,
  alGuardar,
}: {
  cliente: { id: string; nombre: string; telefono: string };
  alGuardar: () => void;
}) {
  const [estado, accion] = useActionState(editarCliente, ESTADO_INICIAL);

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
      <Campo etiqueta="Nombre y apellido" errores={estado.errores?.nombre}>
        {(a11y) => (
          <Input
            {...a11y}
            name="nombre"
            autoComplete="off"
            defaultValue={estado.valores?.nombre ?? cliente.nombre}
            required
          />
        )}
      </Campo>
      <Campo
        etiqueta="Teléfono"
        errores={estado.errores?.telefono}
        ayuda="Si lo cambiás, el cliente va a entrar con el teléfono nuevo."
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={estado.valores?.telefono ?? formatearTelefono(cliente.telefono)}
            required
          />
        )}
      </Campo>
      <BotonEnviar size="lg" textoCargando="Guardando…">
        Guardar cambios
      </BotonEnviar>
    </form>
  );
}

export function DialogoEditarCliente({
  cliente,
}: {
  cliente: { id: string; nombre: string; telefono: string };
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil aria-hidden />
          Editar datos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">Editar datos</DialogTitle>
          <DialogDescription>
            Corregí el nombre o el teléfono de {cliente.nombre.split(" ")[0]}.
          </DialogDescription>
        </DialogHeader>
        {/* Se monta de nuevo en cada apertura: arranca sin errores viejos. */}
        {abierto ? <Formulario cliente={cliente} alGuardar={() => setAbierto(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
