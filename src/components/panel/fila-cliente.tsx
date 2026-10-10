import { ChevronRight, Gift } from "lucide-react";
import Link from "next/link";
import type { ClienteListado } from "@/lib/datos/panel";
import { tiempoRelativo } from "@/lib/fechas";
import { calcularProgreso } from "@/lib/progreso";
import { rutaCliente } from "@/lib/rutas";
import { formatearTelefono } from "@/lib/telefono";
import { cn } from "@/lib/utils";

export function Iniciales({ nombre, className }: { nombre: string; className?: string }) {
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full border border-cuero bg-nogal-claro font-titulo text-[0.9375rem] text-bronce-claro",
        className,
      )}
    >
      {iniciales}
    </span>
  );
}

/** Mini indicador de sellos para listas. */
function MiniProgreso({ llenos, total }: { llenos: number; total: number }) {
  if (total === 0) return null;
  return (
    <span className="flex items-center gap-2" aria-label={`${llenos} de ${total} sellos`}>
      <span className="hidden gap-0.5 sm:flex" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-2.5 rounded-full", i < llenos ? "bg-bronce" : "bg-cuero")}
          />
        ))}
      </span>
      <span className="numeros text-sm text-marfil">
        {llenos}/{total}
      </span>
    </span>
  );
}

export function FilaCliente({ cliente }: { cliente: ClienteListado }) {
  const p = calcularProgreso(cliente);
  return (
    <li>
      <Link
        href={rutaCliente(cliente.id)}
        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-nogal-claro focus-visible:bg-nogal-claro"
      >
        <Iniciales nombre={cliente.nombre} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-marfil">{cliente.nombre}</span>
          <span className="numeros block truncate text-[0.8125rem] text-arena">
            {formatearTelefono(cliente.telefono)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <MiniProgreso llenos={p.mostrados} total={p.necesarios} />
          {p.premiosDisponibles > 0 ? (
            <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-bronce">
              <Gift className="size-3" aria-hidden />
              {p.premiosDisponibles === 1 ? "Premio" : `${p.premiosDisponibles} premios`}
            </span>
          ) : (
            <span className="text-[0.75rem] text-arena">
              {cliente.ultimo_corte ? tiempoRelativo(cliente.ultimo_corte) : "Sin cortes"}
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-cuero" aria-hidden />
      </Link>
    </li>
  );
}
