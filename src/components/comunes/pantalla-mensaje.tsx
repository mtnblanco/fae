import type { ReactNode } from "react";
import { Poste } from "@/components/marca/poste";

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
      className="relative isolate flex min-h-dvh items-center justify-center px-(--gutter) py-16"
    >
      <div
        aria-hidden
        className="textura-grano pointer-events-none absolute inset-0 -z-10 opacity-60"
      />
      <div className="w-full max-w-md text-center">
        <Poste className="mx-auto h-14" />
        {codigo ? <p className="mt-6 font-titulo text-6xl text-bronce">{codigo}</p> : null}
        <h1 className="mt-4 text-[2rem] leading-tight">{titulo}</h1>
        <p className="mt-3 leading-relaxed text-arena">{descripcion}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">{acciones}</div>
      </div>
    </main>
  );
}
