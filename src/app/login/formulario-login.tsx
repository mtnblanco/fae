"use client";

import { useActionState, useState } from "react";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Campo } from "@/components/comunes/campo";
import { InputPassword } from "@/components/comunes/input-password";
import { Input } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/formularios";
import { iniciarSesion } from "./actions";

export function FormularioLogin() {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL);
  const [modo, setModo] = useState<"telefono" | "email">("telefono");
  const esTelefono = modo === "telefono";

  return (
    <form action={accion} className="grid grid-cols-1 gap-5" noValidate>
      <input type="hidden" name="modo" value={modo} />
      <AvisoFormulario
        tipo="error"
        mensaje={estado.estado === "error" ? estado.mensaje : undefined}
      />

      <Campo etiqueta={esTelefono ? "Teléfono" : "Email"} errores={estado.errores?.usuario}>
        {(a11y) => (
          <Input
            key={modo}
            {...a11y}
            name="usuario"
            type={esTelefono ? "tel" : "email"}
            inputMode={esTelefono ? "tel" : "email"}
            autoComplete="username"
            autoCapitalize="none"
            placeholder={esTelefono ? "2346 40-1122" : "tu@email.com"}
            defaultValue={estado.valores?.usuario}
            required
          />
        )}
      </Campo>

      <Campo etiqueta="Contraseña" errores={estado.errores?.password}>
        {(a11y) => (
          <InputPassword {...a11y} name="password" autoComplete="current-password" required />
        )}
      </Campo>

      <BotonEnviar size="lg" variant="neon" className="mt-1 w-full" textoCargando="Ingresando…">
        Ingresar
      </BotonEnviar>

      <button
        type="button"
        onClick={() => setModo(esTelefono ? "email" : "telefono")}
        className="justify-self-center rounded-md px-2 py-1.5 text-sm text-arena underline-offset-4 transition-colors hover:text-marfil hover:underline"
      >
        {esTelefono ? "¿Sos el barbero? Entrá con tu email" : "Soy cliente: entrar con mi teléfono"}
      </button>
    </form>
  );
}
