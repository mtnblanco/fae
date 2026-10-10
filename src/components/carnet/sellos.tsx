"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Gift, Scissors } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

// Cada sello cae con una inclinación distinta, como un sello de verdad.
const INCLINACIONES = [-8, 5, -3, 9, -6, 4, -10, 7, -2, 6, -7, 3, -5, 8, -4, 10, -9, 2, -1, 5];

// Tamaño MÁXIMO de cada sello: si no entran, se achican para no desbordar.
const TAMANOS = {
  sm: "[--sello:2.25rem]",
  md: "[--sello:3rem]",
  lg: "[--sello:3rem] sm:[--sello:4rem]",
} as const;

const CAJA = "block aspect-square w-full";
const ICONO = "size-[38%]";

type Tamano = keyof typeof TAMANOS;

/** Borde festoneado del sello (polígono con muescas). */
function bordeFestoneado(puntas = 44, radioExt = 31, radioInt = 29.6) {
  const puntos: string[] = [];
  for (let i = 0; i < puntas * 2; i++) {
    const r = i % 2 === 0 ? radioExt : radioInt;
    const a = (Math.PI * i) / puntas;
    puntos.push(`${(32 + r * Math.cos(a)).toFixed(2)},${(32 + r * Math.sin(a)).toFixed(2)}`);
  }
  return puntos.join(" ");
}
const BORDE = bordeFestoneado();

/** Sello de bronce "estampado en caliente". */
function SelloLleno() {
  const id = useId();
  return (
    <span className={cn("relative", CAJA)}>
      <svg
        viewBox="0 0 64 64"
        className="absolute inset-0 size-full drop-shadow-[0_2px_3px_rgb(0_0_0/0.55)]"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-oro`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f1d79b" />
            <stop offset=".35" stopColor="#c9a15b" />
            <stop offset=".7" stopColor="#8a6a33" />
            <stop offset="1" stopColor="#d9b56e" />
          </linearGradient>
          <radialGradient id={`${id}-brillo`} cx=".3" cy=".25" r=".6">
            <stop offset="0" stopColor="#fff6dc" stopOpacity=".55" />
            <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <polygon points={BORDE} fill={`url(#${id}-oro)`} />
        <circle
          cx="32"
          cy="32"
          r="24.5"
          fill="none"
          stroke="#5c4420"
          strokeOpacity=".55"
          strokeWidth="1.2"
        />
        <circle
          cx="32"
          cy="32"
          r="21.5"
          fill="none"
          stroke="#fff3cf"
          strokeOpacity=".35"
          strokeWidth=".8"
        />
        <circle cx="32" cy="32" r="30" fill={`url(#${id}-brillo)`} />
      </svg>
      <Scissors
        className={cn("absolute inset-0 m-auto -rotate-45 text-[#4a3618]", ICONO)}
        strokeWidth={2.25}
        aria-hidden
      />
    </span>
  );
}

/** Lugar vacío: un hueco hundido en el cuero. */
function SelloVacio({ premio }: { premio: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-full border border-dashed",
        "bg-black/25 shadow-[inset_0_2px_5px_rgb(0_0_0/0.65),0_1px_0_rgb(255_255_255/0.05)]",
        premio ? "border-bronce/60 text-bronce/80" : "border-cuero text-transparent",
        CAJA,
        "flex",
      )}
    >
      {premio ? <Gift className={ICONO} aria-hidden /> : null}
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
                {/* El hueco queda debajo: el sello "cae" encima. */}
                <span className="absolute inset-0">
                  <SelloVacio premio={false} />
                </span>
                <motion.span
                  className="relative block"
                  initial={
                    esNuevo && !reducirMovimiento
                      ? { scale: 2.2, opacity: 0, rotate: inclinacion - 30, y: -18 }
                      : false
                  }
                  animate={{ scale: 1, opacity: 1, rotate: inclinacion, y: 0 }}
                  transition={
                    esNuevo
                      ? { delay: retardo, type: "spring", stiffness: 520, damping: 18, mass: 0.9 }
                      : { duration: 0 }
                  }
                >
                  <SelloLleno />
                </motion.span>
                {esNuevo && !reducirMovimiento ? (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-bronce-claro"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: [0.9, 1.7], opacity: [0.9, 0] }}
                    transition={{ delay: retardo + 0.12, duration: 0.6, ease: "easeOut" }}
                  />
                ) : null}
              </>
            ) : (
              <SelloVacio premio={i === total - 1} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
