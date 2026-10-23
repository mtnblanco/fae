import { cn } from "@/lib/utils";

/** Iniciales del nombre ("Nahuel Castro" → "NC"). Sin fotos, por pedido del cliente. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function AvatarBarbero({
  nombre,
  tamano = "md",
  className,
}: {
  nombre: string;
  tamano?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-hierro-claro bg-ebano-claro font-titulo leading-none text-oro",
        tamano === "md" ? "size-14 text-[1.375rem]" : "size-9 text-[0.9375rem]",
        className,
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}
