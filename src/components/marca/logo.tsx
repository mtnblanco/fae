import Link from "next/link";
import { sitio } from "@/config/site";
import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  className?: string;
  tamano?: "sm" | "md" | "lg";
  /** La "F" se enciende a saltos (una vez por sesión; ver EncendidoUnico). */
  encender?: boolean;
  /**
   * "neon": la F encendida (el logo de la pantalla).
   * "oro": la F impresa en oro, sin luz (dentro del carnet, donde ya brillan los sellos).
   */
  luz?: "neon" | "oro";
};

/**
 * Logo: la "F" de neón (Tilt Neon, encendida) y el nombre al lado.
 * La "F" mide 28px o más en todos los tamaños, así que lleva el brillo completo
 * (núcleo claro, color en el halo). El nombre va en la misma fuente, en marfil
 * y sin brillo: la luz es una sola.
 */
const TAMANOS = {
  sm: { f: "text-[1.75rem]", texto: "text-[1.0625rem]", gap: "gap-1.5" },
  md: { f: "text-[2.25rem]", texto: "text-[1.375rem]", gap: "gap-2" },
  lg: { f: "text-[3.25rem]", texto: "text-[2rem]", gap: "gap-2.5" },
} as const;

export function Logo({ href, className, tamano = "md", encender = false, luz = "neon" }: Props) {
  const t = TAMANOS[tamano];
  const contenido = (
    <span
      className={cn("inline-flex items-center font-neon leading-none", t.gap, className)}
      translate="no"
    >
      <span
        aria-hidden
        className={cn(
          "-mt-[0.06em] leading-none",
          luz === "neon" ? "neon" : "text-oro",
          t.f,
          encender && luz === "neon" && "encender",
        )}
      >
        F
      </span>
      <span className={cn("tracking-[0.01em] text-marfil", t.texto)}>{sitio.nombre}</span>
    </span>
  );
  if (!href) return contenido;
  return (
    <Link
      href={href}
      className="-my-2 inline-flex rounded-md py-2"
      aria-label={`${sitio.nombreCompleto}, inicio`}
    >
      {contenido}
    </Link>
  );
}
