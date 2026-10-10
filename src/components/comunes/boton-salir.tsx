import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/app/acciones";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { cn } from "@/lib/utils";

export function BotonSalir({
  className,
  compacto = false,
}: {
  className?: string;
  compacto?: boolean;
}) {
  return (
    <form action={cerrarSesion}>
      <BotonEnviar
        variant="ghost"
        size={compacto ? "icon" : "default"}
        className={cn("text-arena hover:text-marfil", className)}
        aria-label={compacto ? "Cerrar sesión" : undefined}
      >
        <LogOut aria-hidden />
        {compacto ? null : "Cerrar sesión"}
      </BotonEnviar>
    </form>
  );
}
