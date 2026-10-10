"use client";

import { ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Campo } from "@/components/comunes/campo";
import { InputPasswordGenerada } from "@/components/comunes/input-password-generada";
import { TarjetaCredenciales } from "@/components/panel/tarjeta-credenciales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type EstadoFormulario, ESTADO_INICIAL } from "@/lib/formularios";
import { generarPassword, PASSWORD_MIN } from "@/lib/password";
import { rutaCliente } from "@/lib/rutas";
import { type Credenciales, crearCliente } from "../acciones";

export function FormularioAlta({ passwordInicial }: { passwordInicial: string }) {
  const [estado, accion] = useActionState<EstadoFormulario<Credenciales>, FormData>(
    crearCliente,
    ESTADO_INICIAL,
  );
  // Cambiar la key reinicia el formulario para cargar otro cliente.
  const [intento, setIntento] = useState(0);
  const [mostrarResultado, setMostrarResultado] = useState(true);

  if (estado.estado === "ok" && estado.datos && mostrarResultado) {
    const c = estado.datos;
    return (
      <div className="grid grid-cols-1 gap-5" aria-live="polite">
        <AvisoFormulario tipo="ok" mensaje={`¡Listo! ${c.nombre} ya tiene su carnet.`} />
        <TarjetaCredenciales
          tipo="alta"
          nombre={c.nombre}
          telefono={c.telefono}
          password={c.password}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" size="lg">
            <Link href={rutaCliente(c.id)}>
              Ver ficha
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setMostrarResultado(false);
              setIntento((i) => i + 1);
            }}
          >
            <UserPlus aria-hidden />
            Cargar otro cliente
          </Button>
        </div>
      </div>
    );
  }

  const errores = mostrarResultado ? estado.errores : undefined;
  const valores = mostrarResultado ? estado.valores : undefined;

  return (
    <form
      key={intento}
      action={(fd) => {
        setMostrarResultado(true);
        accion(fd);
      }}
      className="grid grid-cols-1 gap-5"
      noValidate
    >
      <AvisoFormulario
        tipo="error"
        mensaje={mostrarResultado && estado.estado === "error" ? estado.mensaje : undefined}
      />

      <Campo etiqueta="Nombre y apellido" errores={errores?.nombre}>
        {(a11y) => (
          <Input
            {...a11y}
            name="nombre"
            autoComplete="off"
            autoCapitalize="words"
            placeholder="Juan Pérez"
            defaultValue={valores?.nombre}
            required
          />
        )}
      </Campo>

      <Campo
        etiqueta="Teléfono"
        errores={errores?.telefono}
        ayuda="Con código de área, sin 0 ni 15. Es el usuario con el que va a entrar."
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="2346 40-1122"
            defaultValue={valores?.telefono}
            required
          />
        )}
      </Campo>

      <Campo
        etiqueta="Contraseña inicial"
        errores={errores?.password}
        ayuda={`Mínimo ${PASSWORD_MIN} caracteres. El cliente la cambia la primera vez que entra.`}
      >
        {(a11y) => (
          <InputPasswordGenerada
            {...a11y}
            name="password"
            inicial={intento === 0 ? passwordInicial : generarPassword()}
            required
          />
        )}
      </Campo>

      <BotonEnviar size="lg" className="mt-1" textoCargando="Creando…">
        <UserPlus aria-hidden />
        Crear cliente
      </BotonEnviar>
    </form>
  );
}
