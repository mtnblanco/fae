import { CalendarCheck } from "lucide-react";
import { GrillaSellos } from "@/components/carnet/sellos";
import { formatearFechaCorta } from "@/lib/fechas";
import { cn } from "@/lib/utils";

type Props = {
  incluidos: number;
  /** Cuándo se usó cada corte (del primero al último). */
  usos: string[];
  /** Cuándo la pagó. */
  desde: string;
  /** Cuántos de los últimos cortes se "estampan" con animación. */
  nuevos?: number;
  /** Texto para el cliente ("Te quedan…") o para el barbero ("Le quedan…"). */
  para?: "cliente" | "barbero";
  className?: string;
};

/** La tarjetita de la mensualidad: un lugar por corte, se llena con cada uno. */
export function TarjetaMensualidad({
  incluidos,
  usos,
  desde,
  nuevos = 0,
  para = "barbero",
  className,
}: Props) {
  const quedan = Math.max(0, incluidos - usos.length);
  const quedanTexto = quedan === 1 ? "1 corte" : `${quedan} cortes`;
  return (
    <div
      className={cn(
        "textura-grano rounded-2xl border border-oro/40 bg-ebano p-5 shadow-suave sm:p-6",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 font-titulo text-xl text-marfil">
          <CalendarCheck className="size-5 text-oro" aria-hidden />
          Mensualidad
        </p>
        <p className="numeros text-sm text-arena">
          <span className="text-marfil">{usos.length}</span> de {incluidos}
        </p>
      </div>
      <GrillaSellos
        total={incluidos}
        llenos={usos.length}
        nuevos={nuevos}
        sinPremio
        etiqueta={`Mensualidad: ${usos.length} de ${incluidos} cortes usados`}
        className="mt-4"
      />
      <p className="mt-4 text-sm text-arena">
        {para === "cliente" ? `Te quedan ${quedanTexto}` : `Le quedan ${quedanTexto}`}. Pagada el{" "}
        {formatearFechaCorta(desde)}
        {usos.length > 0
          ? `; ${usos.length === 1 ? "usado el" : "usados el"} ${usos.map((u) => formatearFechaCorta(u).replace(/ de \d{4}$/, "")).join(", ")}`
          : ""}
        .
      </p>
    </div>
  );
}
