"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Gift, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

// La tijera de cada sello queda con una inclinación distinta, como estampada a mano.
const INCLINACIONES = [-8, 5, -3, 9, -6, 4, -10, 7, -2, 6, -7, 3, -5, 8, -4, 10, -9, 2, -1, 5];

// Tamaño MÁXIMO de cada sello: si no entran, se achican para no desbordar.
const TAMANOS = {
  sm: "[--sello:2.25rem]",
  md: "[--sello:3rem]",
  lg: "[--sello:3rem] sm:[--sello:4rem]",
} as const;

const CAJA = "block aspect-square w-full";
const ICONO = "size-[42%]";
const NUMERO = {
  sm: "text-[0.6875rem]",
  md: "text-[0.8125rem]",
  lg: "text-[0.8125rem] sm:text-[0.9375rem]",
} as const;

type Tamano = keyof typeof TAMANOS;

/** Sello ganado: un disco de neón encendido con la tijera. */
function SelloLleno({
  inclinacion,
  retardoEncendido,
}: {
  inclinacion: number;
  /** Si es un sello recién ganado: cuándo se enciende (a saltos, una vez). */
  retardoEncendido: number | null;
}) {
  return (
    <span
      className={cn(
        CAJA,
        "sello-lleno flex items-center justify-center",
        retardoEncendido !== null && "sello-nuevo",
      )}
      style={
        retardoEncendido !== null
          ? ({ "--retardo-sello": `${retardoEncendido}s` } as React.CSSProperties)
          : undefined
      }
    >
      <Scissors
        className={ICONO}
        style={{ rotate: `${inclinacion - 45}deg` }}
        strokeWidth={2.25}
        aria-hidden
      />
    </span>
  );
}

/**
 * Lugar sin sello. El siguiente a ganar va con borde oro y su número; los demás,
 * punteados y apagados. El último muestra el premio.
 */
function SelloVacio({
  numero,
  estado,
  tamano,
}: {
  numero: number;
  estado: "siguiente" | "premio" | "vacio";
  tamano: Tamano;
}) {
  return (
    <span
      className={cn(
        "numeros flex items-center justify-center rounded-full font-semibold",
        estado === "siguiente"
          ? "border-[1.5px] border-oro bg-oro/[0.06] text-oro"
          : estado === "premio"
            ? "border border-dashed border-oro/55 text-oro/85"
            : "border border-dashed border-hierro-claro text-ceniza",
        NUMERO[tamano],
        CAJA,
        "flex",
      )}
    >
      {estado === "premio" ? <Gift className={ICONO} aria-hidden /> : numero}
    </span>
  );
}

/** Columnas para que la grilla quede pareja y entre en 360px (máx. 5). */
function columnasPara(total: number) {
  if (total <= 5) return total;
  if (total === 6) return 3;
  if (total % 4 === 0) return 4;
  return 5;
}

type Props = {
  /** Cantidad total de lugares (cortes necesarios para el premio). */
  total: number;
  /** Sellos llenos. */
  llenos: number;
  /** Cuántos de los últimos sellos llenos se "estampan" con animación. */
  nuevos?: number;
  tamano?: Tamano;
  className?: string;
};

export function GrillaSellos({ total, llenos, nuevos = 0, tamano = "md", className }: Props) {
  const reducirMovimiento = useReducedMotion();
  const primeroNuevo = llenos - nuevos;
  const columnas = columnasPara(total);

  return (
    <ol
      role="img"
      aria-label={`${llenos} de ${total} sellos`}
      className={cn(
        "grid w-full gap-(--hueco) [--hueco:0.625rem] sm:[--hueco:0.75rem]",
        TAMANOS[tamano],
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
        maxWidth: `calc(${columnas} * var(--sello) + ${columnas - 1} * var(--hueco))`,
      }}
    >
      {Array.from({ length: total }, (_, i) => {
        const lleno = i < llenos;
        const esNuevo = lleno && i >= primeroNuevo;
        const inclinacion = INCLINACIONES[i % INCLINACIONES.length] ?? 0;
        const retardo = (i - primeroNuevo) * 0.45 + 0.35;

        return (
          <li key={i} className="relative" aria-hidden>
            {lleno ? (
              <>
                {/* El hueco queda debajo: el sello "cae" encima y se enciende. */}
                <span className="absolute inset-0">
                  <SelloVacio numero={i + 1} estado="vacio" tamano={tamano} />
                </span>
                <motion.span
                  className="relative block"
                  initial={
                    esNuevo && !reducirMovimiento
                      ? { scale: 1.9, opacity: 0, rotate: -20, y: -14 }
                      : false
                  }
                  animate={{ scale: 1, opacity: 1, rotate: 0, y: 0 }}
                  transition={
                    esNuevo
                      ? { delay: retardo, type: "spring", stiffness: 520, damping: 20, mass: 0.9 }
                      : { duration: 0 }
                  }
                >
                  <SelloLleno
                    inclinacion={inclinacion}
                    retardoEncendido={esNuevo && !reducirMovimiento ? retardo + 0.1 : null}
                  />
                </motion.span>
                {esNuevo && !reducirMovimiento ? (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-neon/70"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: [0.9, 1.6], opacity: [0.8, 0] }}
                    transition={{ delay: retardo + 0.12, duration: 0.6, ease: "easeOut" }}
                  />
                ) : null}
              </>
            ) : (
              <SelloVacio
                numero={i + 1}
                estado={i === total - 1 ? "premio" : i === llenos ? "siguiente" : "vacio"}
                tamano={tamano}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
