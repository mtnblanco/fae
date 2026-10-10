import { useId } from "react";
import { cn } from "@/lib/utils";

/** Poste de barbero: el símbolo de la marca. Decorativo salvo que se pase `titulo`. */
export function Poste({ className, titulo }: { className?: string; titulo?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 24 40"
      className={cn("h-8 w-auto", className)}
      role={titulo ? "img" : undefined}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
    >
      <defs>
        <clipPath id={`${id}-cuerpo`}>
          <rect x="7" y="7" width="10" height="26" rx="1.5" />
        </clipPath>
        <linearGradient id={`${id}-metal`} x1="0" x2="1">
          <stop offset="0" stopColor="#8a6a33" />
          <stop offset=".45" stopColor="#e2c27f" />
          <stop offset="1" stopColor="#8a6a33" />
        </linearGradient>
      </defs>
      <rect x="5" y="1" width="14" height="5" rx="2.5" fill={`url(#${id}-metal)`} />
      <g clipPath={`url(#${id}-cuerpo)`}>
        <rect x="7" y="7" width="10" height="26" fill="#eee6d8" />
        {[-6, 4, 14, 24].map((y, i) => (
          <polygon
            key={y}
            points={`7,${y + 10} 17,${y} 17,${y + 4} 7,${y + 14}`}
            fill={i % 2 === 0 ? "#8e2f2b" : "#c9a15b"}
          />
        ))}
      </g>
      <rect x="5" y="34" width="14" height="5" rx="2.5" fill={`url(#${id}-metal)`} />
    </svg>
  );
}
