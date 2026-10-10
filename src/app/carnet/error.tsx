"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorCarnet({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-cuero px-6 py-12 text-center">
      <p className="font-titulo text-2xl">No pudimos cargar tu carnet</p>
      <p className="mt-2 max-w-xs text-sm text-arena">
        Revisá tu conexión a internet y probá de nuevo.
      </p>
      <Button className="mt-6" onClick={reset}>
        <RefreshCw aria-hidden />
        Reintentar
      </Button>
    </div>
  );
}
