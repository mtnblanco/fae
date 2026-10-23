"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

// neón, oro, oro claro, núcleo del neón y marfil (ver globals.css).
const COLORES = ["#ffe14d", "#c9a227", "#ddb93f", "#fff7cc", "#f1ebdd"];
const CANTIDAD = 36;

// Pseudoaleatorio determinístico: misma ráfaga en cada render (sin Math.random en render).
function semilla(i: number, n: number) {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Ráfaga de "virutas" de neón y oro para festejar un premio. Se dispara cada vez
 * que cambia `disparo` (un número que se incrementa) y se va sola.
 */
export function Celebracion({ disparo }: { disparo: number }) {
  const reducir = useReducedMotion();
  const [visible, setVisible] = useState<number | null>(null);

  useEffect(() => {
    if (!disparo || reducir) return;
    const mostrar = setTimeout(() => setVisible(disparo), 0);
    const ocultar = setTimeout(() => setVisible(null), 2600);
    return () => {
      clearTimeout(mostrar);
      clearTimeout(ocultar);
    };
  }, [disparo, reducir]);

  const particulas = useMemo(
    () =>
      Array.from({ length: CANTIDAD }, (_, i) => {
        const angulo = semilla(i, 1) * Math.PI * 2;
        const distancia = 120 + semilla(i, 2) * 200;
        return {
          x: Math.cos(angulo) * distancia,
          y: Math.sin(angulo) * distancia * 0.8 - 60,
          caida: 160 + semilla(i, 3) * 160,
          giro: (semilla(i, 4) - 0.5) * 720,
          ancho: 4 + semilla(i, 5) * 6,
          alto: 10 + semilla(i, 6) * 12,
          color: COLORES[i % COLORES.length],
          retardo: semilla(i, 7) * 0.15,
        };
      }),
    [],
  );

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key={visible}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
        >
          {particulas.map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-[1px]"
              style={{ width: p.ancho, height: p.alto, backgroundColor: p.color }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.4 }}
              animate={{
                x: [0, p.x, p.x * 1.1],
                y: [0, p.y, p.y + p.caida],
                opacity: [0, 1, 0],
                rotate: [0, p.giro / 2, p.giro],
                scale: [0.4, 1, 0.9],
              }}
              transition={{
                duration: 1.9,
                delay: p.retardo,
                ease: [0.16, 1, 0.3, 1],
                times: [0, 0.35, 1],
              }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
