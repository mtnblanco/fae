import type { ReactNode } from "react";
import { Logo } from "@/components/marca/logo";
import { RUTAS } from "@/lib/rutas";

/** Marco de las pantallas de acceso: columna angosta centrada, con la marca arriba. */
export function MarcoAuth({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string;
  descripcion?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="textura-grano pointer-events-none absolute inset-0 -z-10 opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(201_161_91/0.14),transparent)]"
      />
      <header className="contenedor flex h-16 items-center">
        <Logo href={RUTAS.inicio} tamano="sm" />
      </header>
      <main
        id="contenido"
        className="contenedor pb-seguro flex flex-1 flex-col justify-center py-8"
      >
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-[2.25rem] leading-[1.05] text-marfil">{titulo}</h1>
          {descripcion ? (
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-arena">{descripcion}</p>
          ) : null}
          <div className="mt-8">{children}</div>
          {pie ? <div className="mt-8 border-t border-cuero pt-6">{pie}</div> : null}
        </div>
      </main>
    </div>
  );
}
