"use client";

import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

/** Buscador con debounce: actualiza ?q= en la URL sin recargar la página. */
export function BuscadorClientes() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [valor, setValor] = useState(params.get("q") ?? "");
  const [pendiente, startTransition] = useTransition();
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function navegar(q: string) {
    const nuevos = new URLSearchParams(params);
    if (q.trim()) nuevos.set("q", q.trim());
    else nuevos.delete("q");
    nuevos.delete("pagina");
    startTransition(() => router.replace(`${pathname}?${nuevos.toString()}`, { scroll: false }));
  }

  function cambiar(q: string) {
    setValor(q);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => navegar(q), 300);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(temporizador.current);
        navegar(valor);
      }}
      className="relative"
    >
      <label htmlFor="buscar-cliente" className="sr-only">
        Buscar por nombre o teléfono
      </label>
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-arena">
        {pendiente ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Search className="size-4" aria-hidden />
        )}
      </span>
      <Input
        id="buscar-cliente"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        placeholder="Buscar por nombre o teléfono"
        autoComplete="off"
        className="h-12 pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {valor ? (
        <button
          type="button"
          onClick={() => cambiar("")}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-arena hover:text-marfil"
          aria-label="Borrar búsqueda"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </form>
  );
}
