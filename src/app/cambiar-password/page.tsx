import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BotonSalir } from "@/components/comunes/boton-salir";
import { MarcoAuth } from "@/components/comunes/marco-auth";
import { requireUsuario } from "@/lib/auth";
import { RUTAS } from "@/lib/rutas";
import { FormularioCambiarPassword } from "./formulario-cambiar-password";

export const metadata: Metadata = { title: "Cambiar contraseña", robots: { index: false } };

export default async function PaginaCambiarPassword() {
  const { perfil, email } = await requireUsuario({ permitirCambioPendiente: true });
  const obligatorio = perfil.debe_cambiar_password;
  const volverA = perfil.rol === "barbero" ? RUTAS.panel : RUTAS.carnet;
  const nombre = perfil.nombre.split(" ")[0];

  return (
    <MarcoAuth
      titulo={obligatorio ? `Hola, ${nombre}` : "Cambiar contraseña"}
      descripcion={
        obligatorio
          ? "Antes de seguir, elegí tu propia contraseña. La que te dimos era temporal."
          : "Elegí una contraseña nueva para tu cuenta."
      }
      pie={
        obligatorio ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-arena">¿No sos {nombre}?</p>
            <BotonSalir />
          </div>
        ) : (
          <Link
            href={volverA}
            className="-my-2.5 inline-flex items-center gap-2 rounded-md py-2.5 text-sm text-arena transition-colors hover:text-marfil"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver sin cambiarla
          </Link>
        )
      }
    >
      <FormularioCambiarPassword
        obligatorio={obligatorio}
        esCliente={perfil.rol === "cliente"}
        usuario={perfil.telefono ?? email ?? ""}
      />
    </MarcoAuth>
  );
}
