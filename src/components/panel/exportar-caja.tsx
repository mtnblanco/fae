"use client";

import { Download, FileSpreadsheet, FileText, Loader2, Share2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ERROR_GENERICO } from "@/lib/errores";
import { type FormatoInforme, leerRangoInforme, nombreArchivoInforme } from "@/lib/informe";
import type { Rango } from "@/lib/periodos";
import { RUTAS } from "@/lib/rutas";

const TIPOS: Record<FormatoInforme, string> = { pdf: "application/pdf", csv: "text/csv" };

function descargar(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** En el celular (iPhone sobre todo) se comparte: WhatsApp, Mail, Archivos… */
const puedeCompartir = (archivo: File) =>
  typeof navigator.canShare === "function" && navigator.canShare({ files: [archivo] });

/**
 * Informe para el contador: el dueño elige desde y hasta y lo baja en PDF o en
 * Excel (CSV). Donde se puede compartir archivos (celular), queda listo para
 * mandarlo; si no, se descarga.
 */
export function ExportarCaja({ rango, hoy }: { rango: Rango; hoy: string }) {
  const [desde, setDesde] = useState(rango.desde);
  const [hasta, setHasta] = useState(rango.hasta);
  const [listo, setListo] = useState<File | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [formatoPedido, setFormatoPedido] = useState<FormatoInforme | null>(null);

  // Si cambia el período de la caja, el informe arranca por ese período.
  const clave = `${rango.desde}:${rango.hasta}`;
  const [claveAnterior, setClaveAnterior] = useState(clave);
  if (clave !== claveAnterior) {
    setClaveAnterior(clave);
    setDesde(rango.desde);
    setHasta(rango.hasta);
    setListo(null);
  }

  function generar(formato: FormatoInforme) {
    const pedido = leerRangoInforme(desde, hasta);
    if (!pedido) {
      toast.error("Revisá las fechas: el “hasta” no puede ser anterior al “desde”.");
      return;
    }
    setFormatoPedido(formato);
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ ...pedido, formato });
        const r = await fetch(`${RUTAS.cajaExportar}?${params}`, { cache: "no-store" });
        const tipo = r.headers.get("content-type") ?? "";
        if (!r.ok || !tipo.startsWith(TIPOS[formato])) {
          toast.error(r.status === 400 ? await r.text() : ERROR_GENERICO);
          return;
        }
        const archivo = new File([await r.blob()], nombreArchivoInforme(pedido, formato), {
          type: TIPOS[formato],
        });
        if (puedeCompartir(archivo)) setListo(archivo);
        else {
          descargar(archivo);
          toast.success("Informe descargado", { description: archivo.name });
        }
      } catch {
        toast.error("No se pudo generar el informe. Revisá la conexión y probá de nuevo.");
      }
    });
  }

  async function compartir(archivo: File) {
    try {
      await navigator.share({ files: [archivo], title: archivo.name });
    } catch (e) {
      // Cerrar la hoja de compartir no es un error.
      if (e instanceof DOMException && e.name === "AbortError") return;
      descargar(archivo);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-hierro bg-ebano p-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="exportar-desde">Desde</Label>
          <Input
            id="exportar-desde"
            type="date"
            required
            max={hasta || hoy}
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              // Un archivo generado vale para el período que estaba elegido.
              setListo(null);
            }}
            className="h-12"
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="exportar-hasta">Hasta</Label>
          <Input
            id="exportar-hasta"
            type="date"
            required
            min={desde}
            max={hoy}
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setListo(null);
            }}
            className="h-12"
          />
        </div>
      </div>
      <p className="text-[0.8125rem] leading-snug text-arena">
        Cada servicio con su día, barbero, monto y medio de pago, y los totales por barbero.
      </p>

      {listo ? (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-oro/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm text-marfil">{listo.name}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setListo(null)}
              aria-label="Cerrar"
              className="-my-2 shrink-0 text-arena"
            >
              <X aria-hidden />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" onClick={() => compartir(listo)}>
              <Share2 aria-hidden />
              Compartir
            </Button>
            <Button size="lg" variant="outline" onClick={() => descargar(listo)}>
              <Download aria-hidden />
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { formato: "pdf", etiqueta: "PDF", Icono: FileText, variante: "default" },
              { formato: "csv", etiqueta: "Excel", Icono: FileSpreadsheet, variante: "outline" },
            ] as const
          ).map(({ formato, etiqueta, Icono, variante }) => (
            <Button
              key={formato}
              size="lg"
              variant={variante}
              disabled={pendiente}
              aria-busy={(pendiente && formatoPedido === formato) || undefined}
              onClick={() => generar(formato)}
            >
              {pendiente && formatoPedido === formato ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Icono aria-hidden />
              )}
              {etiqueta}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
