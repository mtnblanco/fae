"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";
import { resetearPassword, type Credenciales } from "@/app/panel/clientes/acciones";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Campo } from "@/components/comunes/campo";
import { InputPasswordGenerada } from "@/components/comunes/input-password-generada";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type EstadoFormulario, ESTADO_INICIAL } from "@/lib/formularios";
import { generarPassword, PASSWORD_MIN } from "@/lib/password";
import { TarjetaCredenciales } from "./tarjeta-credenciales";

function Contenido({ clienteId }: { clienteId: string }) {
  const [estado, accion] = useActionState<EstadoFormulario<Credenciales>, FormData>(
    resetearPassword,
    ESTADO_INICIAL,
  );
  const [inicial] = useState(generarPassword);

  if (estado.estado === "ok" && estado.datos) {
    const c = estado.datos;
    return (
      <TarjetaCredenciales
        tipo="reseteo"
        nombre={c.nombre}
        telefono={c.telefono}
        password={c.password}
      />
    );
  }

  return (
    <form action={accion} className="grid grid-cols-1 gap-5" noValidate>
      <input type="hidden" name="id" value={clienteId} />
      <AvisoFormulario
        tipo="error"
        mensaje={estado.estado === "error" ? estado.mensaje : undefined}
      />
      <Campo
        etiqueta="Contraseña temporal"
        errores={estado.errores?.password}
        ayuda={`Mínimo ${PASSWORD_MIN} caracteres. Al entrar, el cliente va a tener que cambiarla.`}
      >
        {(a11y) => <InputPasswordGenerada {...a11y} name="password" inicial={inicial} required />}
      </Campo>
      <BotonEnviar size="lg" textoCargando="Guardando…">
        <KeyRound aria-hidden />
        Asignar contraseña
      </BotonEnviar>
    </form>
  );
}

export function DialogoResetearPassword({ cliente }: { cliente: { id: string; nombre: string } }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound aria-hidden />
          Resetear contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">
            Resetear contraseña
          </DialogTitle>
          <DialogDescription>
            Para cuando {cliente.nombre.split(" ")[0]} se olvidó la suya. La contraseña anterior
            deja de funcionar.
          </DialogDescription>
        </DialogHeader>
        {abierto ? <Contenido clienteId={cliente.id} /> : null}
      </DialogContent>
    </Dialog>
  );
}
