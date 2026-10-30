"use client";

import { Download, ImageIcon, Loader2, Share2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { compartir, descargar, puedeCompartir } from "@/lib/compartir";
import { ERROR_GENERICO } from "@/lib/errores";
import { RUTAS } from "@/lib/rutas";

type Lista = { archivo: File; url: string; compartible: boolean };

/**
 * "Imagen para historia": genera la historia de Instagram con los horarios
 * libres del barbero en el día elegido, la muestra y la deja lista para
 * compartir (celular) o guardar.
 */
export function BotonHistoria({ barberoId, fecha }: { barberoId: string; fecha: string }) {
  const [lista, setLista] = useState<Lista | null>(null);
  const [pendiente, startTransition] = useTransition();

  // La vista previa usa una URL del navegador: se libera al cerrar.
  useEffect(() => () => (lista ? URL.revokeObjectURL(lista.url) : undefined), [lista]);

  function generar() {
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ barbero: barberoId, fecha });
        const r = await fetch(`${RUTAS.historia}?${params}`, { cache: "no-store" });
        if (!r.ok || !(r.headers.get("content-type") ?? "").startsWith("image/png")) {
          toast.error(r.status === 400 || r.status === 404 ? await r.text() : ERROR_GENERICO);
          return;
        }
        const nombre =
          /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ??
          `turnos-${fecha}.png`;
        const archivo = new File([await r.blob()], nombre, { type: "image/png" });
        setLista({
          archivo,
          url: URL.createObjectURL(archivo),
          compartible: puedeCompartir(archivo),
        });
      } catch {
        toast.error("No se pudo generar la imagen. Revisá la conexión y probá de nuevo.");
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-11"
        onClick={generar}
        disabled={pendiente}
        aria-busy={pendiente || undefined}
      >
        {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <ImageIcon aria-hidden />}
        {pendiente ? "Generando…" : "Imagen para historia"}
      </Button>
      <Dialog open={lista !== null} onOpenChange={(abierto) => (abierto ? null : setLista(null))}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-titulo text-2xl font-normal">Historia lista</DialogTitle>
            <DialogDescription>
              Al subirla a Instagram, sumale el sticker de link a {RUTAS.turnos} en el espacio de
              abajo.
            </DialogDescription>
          </DialogHeader>
          {lista ? (
            <div className="grid grid-cols-1 gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- imagen local (blob), sin optimizar */}
              <img
                src={lista.url}
                alt="Vista previa de la historia con los horarios libres"
                width={1080}
                height={1920}
                className="mx-auto h-auto max-h-[55dvh] w-auto rounded-lg border border-hierro"
              />
              <div className={lista.compartible ? "grid grid-cols-2 gap-3" : "grid grid-cols-1"}>
                {lista.compartible ? (
                  <Button size="lg" onClick={() => compartir(lista.archivo)}>
                    <Share2 aria-hidden />
                    Compartir
                  </Button>
                ) : null}
                <Button
                  size="lg"
                  variant={lista.compartible ? "outline" : "default"}
                  onClick={() => descargar(lista.archivo)}
                >
                  <Download aria-hidden />
                  Guardar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
