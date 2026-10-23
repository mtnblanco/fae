"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Campo } from "@/components/comunes/campo";
import { InputPassword } from "@/components/comunes/input-password";
import { ESTADO_INICIAL } from "@/lib/formularios";
import { PASSWORD_MIN } from "@/lib/password";
import { cambiarPassword } from "./actions";

export function FormularioCambiarPassword({
  obligatorio,
  usuario,
  esCliente,
}: {
  obligatorio: boolean;
  usuario: string;
  esCliente: boolean;
}) {
  const [estado, accion] = useActionState(cambiarPassword, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.estado === "ok") {
      toast.success(estado.mensaje);
      formRef.current?.reset();
    }
  }, [estado]);

  return (
    <form ref={formRef} action={accion} className="grid grid-cols-1 gap-5" noValidate>
      <AvisoFormulario
        tipo="error"
        mensaje={estado.estado === "error" ? estado.mensaje : undefined}
      />

      {/* Ayuda a los gestores de contraseñas a asociarla con la cuenta. */}
      <input type="text" name="username" autoComplete="username" value={usuario} hidden readOnly />

      {/* También en el cambio obligatorio: así una sesión vieja no puede elegir la nueva. */}
      <Campo
        etiqueta={
          obligatorio
            ? esCliente
              ? "Contraseña que te dio tu barbero"
              : "Contraseña temporal"
            : "Contraseña actual"
        }
        errores={estado.errores?.actual}
        ayuda={
          obligatorio
            ? esCliente
              ? "La misma con la que acabás de entrar (te la pasó el barbero, por ejemplo por WhatsApp)."
              : "La misma con la que acabás de entrar."
            : undefined
        }
      >
        {(a11y) => (
          <InputPassword {...a11y} name="actual" autoComplete="current-password" required />
        )}
      </Campo>

      <Campo
        etiqueta="Contraseña nueva"
        errores={estado.errores?.nueva}
        ayuda={`Al menos ${PASSWORD_MIN} caracteres. Elegí una que recuerdes y que no uses en otro lado.`}
      >
        {(a11y) => (
          <InputPassword
            {...a11y}
            name="nueva"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
          />
        )}
      </Campo>

      <Campo etiqueta="Repetí la contraseña nueva" errores={estado.errores?.confirmacion}>
        {(a11y) => (
          <InputPassword {...a11y} name="confirmacion" autoComplete="new-password" required />
        )}
      </Campo>

      <BotonEnviar size="lg" className="mt-1 w-full" textoCargando="Guardando…">
        {obligatorio ? "Guardar y entrar" : "Cambiar contraseña"}
      </BotonEnviar>
    </form>
  );
}
