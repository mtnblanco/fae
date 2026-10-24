import { Store } from "lucide-react";
import { urlFotoDescuento } from "@/lib/descuentos";
import { cn } from "@/lib/utils";

type Props = {
  descuento: { id: string; comercio: string; foto_actualizada_en: string | null };
  /** Ancho y alto intrínsecos (el tamaño en pantalla lo da className). */
  ancho: number;
  alto: number;
  className?: string;
};

/**
 * Foto del local de un descuento o, si no tiene, un mosaico con el ícono de
 * comercio. La imagen la sirve /descuentos/[id]/foto (misma origin: pasa la
 * CSP) con caché largo: la URL cambia con cada foto nueva.
 */
export function FotoComercio({ descuento, ancho, alto, className }: Props) {
  if (!descuento.foto_actualizada_en) {
    return (
      <span
        aria-hidden
        className={cn("flex items-center justify-center bg-ebano-claro text-oro", className)}
      >
        <Store className="size-[1.125rem]" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ya viene chica (≤ 1200 px, WebP) y con caché; next/image no suma nada acá.
    <img
      src={urlFotoDescuento(descuento.id, descuento.foto_actualizada_en)}
      alt={`Local de ${descuento.comercio}`}
      width={ancho}
      height={alto}
      loading="lazy"
      decoding="async"
      className={cn("bg-ebano-claro object-cover", className)}
    />
  );
}
