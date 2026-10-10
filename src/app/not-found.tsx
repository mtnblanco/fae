import type { Metadata } from "next";
import Link from "next/link";
import { PantallaMensaje } from "@/components/comunes/pantalla-mensaje";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NoEncontrada() {
  return (
    <PantallaMensaje
      codigo="404"
      titulo="Acá no hay nada para cortar"
      descripcion="La página que buscás no existe o se movió. Revisá la dirección o volvé al inicio."
      acciones={
        <>
          <Button asChild size="lg">
            <Link href="/">Ir al inicio</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Entrar a mi carnet</Link>
          </Button>
        </>
      }
    />
  );
}
