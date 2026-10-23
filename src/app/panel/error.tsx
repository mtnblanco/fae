"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RUTAS } from "@/lib/rutas";

export default function ErrorPanel({
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
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-hierro px-6 py-12 text-center">
      <p className="font-titulo text-2xl">No pudimos cargar esta sección</p>
      <p className="mt-2 text-sm text-arena">
        Puede ser la conexión. Probá de nuevo en unos segundos.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw aria-hidden />
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link href={RUTAS.panel}>Ir al inicio del panel</Link>
        </Button>
      </div>
    </div>
  );
}
