import Link from "next/link";
import { sitio } from "@/config/site";
import { cn } from "@/lib/utils";
import { Poste } from "./poste";

type Props = { href?: string; className?: string; tamano?: "sm" | "md" | "lg" };

const TAMANOS = {
  sm: { poste: "h-7", texto: "text-xl" },
  md: { poste: "h-9", texto: "text-2xl" },
  lg: { poste: "h-12", texto: "text-4xl" },
} as const;

export function Logo({ href, className, tamano = "md" }: Props) {
  const t = TAMANOS[tamano];
  const contenido = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Poste className={t.poste} />
      <span className={cn("font-titulo leading-none text-marfil", t.texto)}>{sitio.nombre}</span>
    </span>
  );
  if (!href) return contenido;
  return (
    <Link href={href} className="rounded-md" aria-label={`${sitio.nombreCompleto}, inicio`}>
      {contenido}
    </Link>
  );
}
