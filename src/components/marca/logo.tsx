import Link from "next/link";
import { sitio } from "@/config/site";
import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  className?: string;
  tamano?: "sm" | "md" | "lg";
};

/**
 * Logo en pantalla: solo el nombre, en Tilt Neon y marfil, sin brillo.
 * La "F" de neón se reserva para el favicon, el ícono de la app y la imagen OG
 * (ver src/lib/marca-svg.ts).
 */
const TAMANOS = {
  sm: "text-[1.1875rem]",
  md: "text-[1.5rem]",
  lg: "text-[2.125rem]",
} as const;

export function Logo({ href, className, tamano = "md" }: Props) {
  const contenido = (
    <span
      className={cn(
        "inline-flex items-center font-neon leading-none tracking-[0.01em] text-marfil",
        TAMANOS[tamano],
        className,
      )}
      translate="no"
    >
      {sitio.nombre}
    </span>
  );
  if (!href) return contenido;
  return (
    <Link
      href={href}
      className="-my-2.5 inline-flex rounded-md py-2.5"
      aria-label={`${sitio.nombreCompleto}, inicio`}
    >
      {contenido}
    </Link>
  );
}
