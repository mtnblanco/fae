import { UserX } from "lucide-react";
import Link from "next/link";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { Button } from "@/components/ui/button";
import { RUTAS } from "@/lib/rutas";

export default function ClienteNoEncontrado() {
  return (
    <EstadoVacio
      icono={UserX}
      titulo="No encontramos a este cliente"
      descripcion="Puede que lo hayan dado de baja o que el enlace esté mal."
      accion={
        <Button asChild>
          <Link href={RUTAS.clientes}>Ver clientes</Link>
        </Button>
      }
      className="mx-auto max-w-lg"
    />
  );
}
