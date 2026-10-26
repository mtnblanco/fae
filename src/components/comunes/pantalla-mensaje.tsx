import type { ReactNode } from "react";
import { Logo } from "@/components/marca/logo";

/** Pantalla centrada para 404 y errores. */
export function PantallaMensaje({
  codigo,
  titulo,
  descripcion,
  acciones,
}: {
  codigo?: string;
  titulo: string;
  descripcion: ReactNode;
  acciones: ReactNode;
}) {
  return (
    <main
      id="contenido"
      className="px-seguro relative isolate flex min-h-dvh items-center justify-center pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))]"
    >
      <div
        aria-hidden
        className="textura-grano pointer-events-none absolute inset-0 -z-10 opacity-50"
      />
      <div className="w-full max-w-md text-center">
        <Logo tamano="md" />
        {codigo ? <p className="numeros mt-8 font-titulo text-6xl text-oro">{codigo}</p> : null}
        <h1 className="mt-4 text-[2rem] leading-tight">{titulo}</h1>
        <p className="mt-3 leading-relaxed text-arena">{descripcion}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">{acciones}</div>
      </div>
    </main>
  );
}
