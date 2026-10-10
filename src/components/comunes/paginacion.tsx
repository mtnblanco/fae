import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  /** Arma el href para una página dada (conserva búsqueda y filtros). */
  hrefPara: (pagina: number) => string;
  sustantivo?: [singular: string, plural: string];
};

export function Paginacion({
  pagina,
  paginas,
  total,
  porPagina,
  hrefPara,
  sustantivo = ["resultado", "resultados"],
}: Props) {
  if (total === 0) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  const nombre = total === 1 ? sustantivo[0] : sustantivo[1];

  return (
    <nav aria-label="Paginación" className="mt-6 flex items-center justify-between gap-4">
      <p className="text-sm text-arena" aria-live="polite">
        {paginas > 1 ? `${desde}–${hasta} de ${total} ${nombre}` : `${total} ${nombre}`}
      </p>
      {paginas > 1 ? (
        <div className="flex gap-2">
          {pagina > 1 ? (
            <Button asChild variant="outline" size="icon" aria-label="Página anterior">
              <Link href={hrefPara(pagina - 1)} scroll={false}>
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" disabled aria-label="Página anterior">
              <ChevronLeft aria-hidden />
            </Button>
          )}
          {pagina < paginas ? (
            <Button asChild variant="outline" size="icon" aria-label="Página siguiente">
              <Link href={hrefPara(pagina + 1)} scroll={false}>
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" disabled aria-label="Página siguiente">
              <ChevronRight aria-hidden />
            </Button>
          )}
        </div>
      ) : null}
    </nav>
  );
}
