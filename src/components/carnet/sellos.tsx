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

/** Sello ganado: un disco de neón encendido con la tijera (o el regalo, si ahí hay premio). */
function SelloLleno({
  inclinacion,
  retardoEncendido,
  premio,
}: {
  inclinacion: number;
  premio: boolean;
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
      {premio ? (
        <Gift className={ICONO} strokeWidth={2.25} aria-hidden />
      ) : (
        <Scissors
          className={ICONO}
          style={{ rotate: `${inclinacion - 45}deg` }}
          strokeWidth={2.25}
          aria-hidden
        />
      )}
    </span>
  );
}

/**
 * Lugar sin sello. El siguiente a ganar va con borde oro y su número; los demás,
 * punteados y apagados. Los lugares con premio (cada etapa) muestran el regalo.
 */
function SelloVacio({
  numero,
  estado,
  premio = false,
  tamano,
}: {
  numero: number;
  estado: "siguiente" | "vacio";
  premio?: boolean;
  tamano: Tamano;
}) {
  return (
    <span
      className={cn(
        "numeros flex items-center justify-center rounded-full font-semibold",
        estado === "siguiente"
          ? "border-[1.5px] border-oro bg-oro/[0.06] text-oro"
          : premio
            ? "border border-dashed border-oro/55 text-oro/85"
            : "border border-dashed border-hierro-claro text-ceniza",
        NUMERO[tamano],
        CAJA,
        "flex",
      )}
    >
      {premio ? <Gift className={ICONO} aria-hidden /> : numero}
    </span>
  );
}

/**
 * Columnas para que la grilla quede pareja y entre en 360px: hasta 10 sellos,
 * máx. 5 por fila; con más (tarjetas de hasta 30), 5 o 6 por fila, la que deje
 * la última fila más completa.
 */
export function columnasPara(total: number) {
  if (total <= 5) return total;
  if (total === 6) return 3;
  if (total <= 12) return total % 4 === 0 ? 4 : 5;
  const vacios = (c: number) => (c - (total % c)) % c;
  return vacios(5) < vacios(6) ? 5 : 6;
}

type Props = {
  /** Cantidad total de lugares (largo de la tarjeta). */
  total: number;
  /** En qué cortes hay premio (las etapas). Por defecto, solo el último. */
  premios?: number[];
  /** Sin premios (la tarjeta de la mensualidad). */
  sinPremio?: boolean;
  /** Para lectores de pantalla (por defecto, "N de M sellos"). */
  etiqueta?: string;
  /** Sellos llenos. */
  llenos: number;
  /** Cuántos de los últimos sellos llenos se "estampan" con animación. */
  nuevos?: number;
  tamano?: Tamano;
  className?: string;
};

export function GrillaSellos({
  total,
  premios,
  sinPremio = false,
  etiqueta,
  llenos,
  nuevos = 0,
  tamano = "md",
  className,
}: Props) {
  const reducirMovimiento = useReducedMotion();
  const primeroNuevo = llenos - nuevos;
  const columnas = columnasPara(total);
  const conPremio = new Set(sinPremio ? [] : premios?.length ? premios : [total]);
  const etapas = [...conPremio].sort((a, b) => a - b);

  return (
    <ol
      role="img"
      aria-label={
        etiqueta ??
        `${llenos} de ${total} sellos${
          etapas.length > 1 ? `. Premios en los cortes ${etapas.join(", ")}` : ""
        }`
      }
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
                  <SelloVacio
                    numero={i + 1}
                    estado="vacio"
                    premio={conPremio.has(i + 1)}
                    tamano={tamano}
                  />
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
                    premio={conPremio.has(i + 1)}
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
                estado={i === llenos ? "siguiente" : "vacio"}
                premio={conPremio.has(i + 1)}
                tamano={tamano}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
