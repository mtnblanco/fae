"use client";

import { motion, useReducedMotion } from "framer-motion";
import { QrCode, RotateCcw } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { Logo } from "@/components/marca/logo";
import { Button } from "@/components/ui/button";
import { calcularProgreso, textoCortes } from "@/lib/progreso";
import { cn } from "@/lib/utils";
import { Celebracion } from "./celebracion";
import { GrillaSellos } from "./sellos";

type Props = {
  cliente: {
    id: string;
    nombre: string;
    total_cortes: number;
    sellos_actuales: number;
    premios_disponibles: number;
    cortes_necesarios: number | null;
    descripcion_premio: string | null;
  };
  socioDesde: string;
  numeroSocio: string;
  qrSvg: string;
};

type Visto = { total: number; premios: number };

const claveVisto = (id: string) => `carnet:${id}:visto`;

function leerVisto(id: string): Visto | null {
  try {
    const crudo = localStorage.getItem(claveVisto(id));
    if (!crudo) return null;
    const v = JSON.parse(crudo) as Partial<Visto>;
    return typeof v.total === "number" && typeof v.premios === "number"
      ? { total: v.total, premios: v.premios }
      : null;
  } catch {
    return null;
  }
}

// useLayoutEffect en el cliente (antes de pintar), useEffect en el servidor.
const useEfectoAntesDePintar = typeof window === "undefined" ? useEffect : useLayoutEffect;

function Cara({
  children,
  dorso = false,
  oculta,
  encendida = false,
}: {
  children: React.ReactNode;
  dorso?: boolean;
  oculta: boolean;
  /** Premio listo: el carnet entero se enciende (halo suave, sin animar la sombra). */
  encendida?: boolean;
}) {
  return (
    <div
      inert={oculta}
      className={cn(
        "textura-grano overflow-hidden rounded-[1.375rem] bg-ebano [backface-visibility:hidden]",
        encendida ? "shadow-[var(--brillo-caja-suave),var(--sombra-carnet)]" : "shadow-carnet",
        // El frente define el alto (crece si hay muchos sellos); el dorso lo copia.
        dorso ? "absolute inset-0" : "relative aspect-[1/1.18] min-[400px]:aspect-[1/1.05]",
      )}
      style={dorso ? { transform: "rotateY(180deg)" } : undefined}
    >
      {/* Luz cálida que llega de arriba y filete de oro */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_70%_at_15%_0%,rgb(255_190_30/0.08),transparent_60%),radial-gradient(90%_70%_at_100%_100%,rgb(0_0_0/0.45),transparent_60%)]"
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-2.5 rounded-[1rem] border",
          encendida ? "border-neon/40" : "border-oro/30",
        )}
      />
      <div className="relative flex h-full flex-col p-6">{children}</div>
    </div>
  );
}

export function TarjetaCarnet({ cliente, socioDesde, numeroSocio, qrSvg }: Props) {
  const p = calcularProgreso(cliente);
  const reducir = useReducedMotion();
  const [dadaVuelta, setDadaVuelta] = useState(false);

  // ── Qué sellos "estampar" ────────────────────────────────────────────────
  // `base` es contra qué se comparan los datos actuales: lo último que vio el
  // cliente (guardado en el navegador) o, en vivo, los datos anteriores.
  const [base, setBase] = useState<Visto | undefined>(undefined);
  const [claveGrilla, setClaveGrilla] = useState(0);
  const [festejo, setFestejo] = useState(0);
  const [previos, setPrevios] = useState<Visto>({
    total: cliente.total_cortes,
    premios: cliente.premios_disponibles,
  });

  if (previos.total !== cliente.total_cortes || previos.premios !== cliente.premios_disponibles) {
    // Llegaron datos nuevos (Realtime o refresco): comparamos contra los anteriores.
    setBase(previos);
    setPrevios({ total: cliente.total_cortes, premios: cliente.premios_disponibles });
    setClaveGrilla((k) => k + 1);
    if (cliente.premios_disponibles > previos.premios) setFestejo((n) => n + 1);
  }

  useEfectoAntesDePintar(() => {
    const visto = leerVisto(cliente.id);
    // Primera vez: se estampan todos los sellos actuales, uno por uno.
    const inicial = visto ?? {
      total: cliente.total_cortes - p.mostrados,
      premios: cliente.premios_disponibles,
    };
    setBase(inicial);
    setClaveGrilla((k) => k + 1);
    if (visto && cliente.premios_disponibles > visto.premios) setFestejo((n) => n + 1);
    // Solo al montar: las actualizaciones en vivo se manejan arriba.
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        claveVisto(cliente.id),
        JSON.stringify({ total: cliente.total_cortes, premios: cliente.premios_disponibles }),
      );
    } catch {
      // Navegación privada o almacenamiento bloqueado: no pasa nada.
    }
  }, [cliente.id, cliente.total_cortes, cliente.premios_disponibles]);

  const nuevos = base ? Math.min(p.mostrados, Math.max(0, cliente.total_cortes - base.total)) : 0;

  return (
    <section aria-labelledby="titulo-carnet" className="grid grid-cols-1 gap-4">
      <Celebracion disparo={festejo} />
      <h2 id="titulo-carnet" className="sr-only">
        Tu carnet
      </h2>

      <div className="[perspective:1400px]">
        <motion.div
          className="relative w-full [transform-style:preserve-3d]"
          animate={{ rotateY: dadaVuelta ? 180 : 0 }}
          transition={reducir ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 20 }}
        >
          {/* Frente: sellos */}
          <Cara oculta={dadaVuelta} encendida={p.faltan === 0 && p.necesarios > 0}>
            <div className="flex items-start justify-between gap-4">
              <Logo tamano="sm" />
              <span className="text-right text-[0.6875rem] leading-tight text-arena">
                Socio n.º <span className="numeros text-marfil">{numeroSocio}</span>
                <br />
                desde {socioDesde}
              </span>
            </div>

            <p className="mt-auto pt-8 font-titulo text-[2rem] leading-[1.05] break-words text-marfil min-[400px]:text-[2.25rem]">
              {cliente.nombre}
            </p>

            {p.necesarios > 0 ? (
              <div className="mt-5">
                <GrillaSellos
                  key={claveGrilla}
                  total={p.necesarios}
                  llenos={p.mostrados}
                  nuevos={nuevos}
                  tamano="lg"
                />
                <p className="mt-4 text-sm leading-snug text-arena" aria-live="polite">
                  {p.faltan === 0 ? (
                    <span className="font-medium text-oro-claro">
                      ¡Tarjeta completa! Tu premio te espera.
                    </span>
                  ) : (
                    <>
                      <span className="numeros text-marfil">
                        {p.mostrados} de {p.necesarios}
                      </span>
                      . Te {p.faltan === 1 ? "falta" : "faltan"} {textoCortes(p.faltan)} para{" "}
                      {cliente.descripcion_premio?.toLowerCase()}.
                    </>
                  )}
                </p>
              </div>
            ) : null}
          </Cara>

          {/* Dorso: QR */}
          <Cara dorso oculta={!dadaVuelta}>
            <p className="text-center text-sm text-arena">Mostrale este código a tu barbero</p>
            <div className="mx-auto my-auto w-[72%] max-w-64 rounded-2xl bg-marfil p-4 shadow-elevada">
              <div
                role="img"
                aria-label={`Código QR del carnet de ${cliente.nombre}`}
                className="aspect-square [&_svg]:size-full"
                // SVG generado en nuestro servidor con la librería qrcode (no es contenido del usuario).
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>
            <p className="text-center font-titulo text-xl text-marfil">{cliente.nombre}</p>
          </Cara>
        </motion.div>
      </div>

      <Button
        size="xl"
        variant={dadaVuelta ? "outline" : "default"}
        onClick={() => setDadaVuelta((v) => !v)}
        aria-pressed={dadaVuelta}
      >
        {dadaVuelta ? <RotateCcw aria-hidden /> : <QrCode aria-hidden />}
        {dadaVuelta ? "Ver mis sellos" : "Mostrar mi QR"}
      </Button>
    </section>
  );
}
