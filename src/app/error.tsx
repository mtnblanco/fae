"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PantallaMensaje } from "@/components/comunes/pantalla-mensaje";
import { Button } from "@/components/ui/button";

export default function ErrorGeneral({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PantallaMensaje
      titulo="Algo salió mal"
      descripcion={
        <>
          No pudimos cargar esta pantalla. Puede ser la conexión: probá de nuevo en unos segundos.
          {error.digest ? (
            <span className="mt-2 block text-[0.8125rem]">Código: {error.digest}</span>
          ) : null}
        </>
      }
      acciones={
        <>
          <Button size="lg" onClick={reset}>
            Reintentar
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Ir al inicio</Link>
          </Button>
        </>
      }
    />
  );
}
