import type { Metadata } from "next";
import { MarcoAuth } from "@/components/comunes/marco-auth";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Entrá a tu carnet de beneficios con tu teléfono y contraseña.",
};

export default function PaginaLogin() {
  return (
    <MarcoAuth
      titulo="Entrá a tu carnet"
      descripcion="Usá el teléfono y la contraseña que te dio tu barbero."
      pie={
        <p className="text-sm leading-relaxed text-arena">
          ¿Te olvidaste la contraseña? <span className="text-marfil">Pedísela a tu barbero</span>:
          te genera una nueva en el momento.
        </p>
      }
    >
      <FormularioLogin />
    </MarcoAuth>
  );
}
