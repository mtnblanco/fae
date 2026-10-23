import { dataUri, svgF } from "@/lib/marca-svg";

type Variante = "favicon" | "app" | "maskable";

const VARIANTES = {
  // 16–32 px: la F más grande, tubo más grueso y halo corto para que no empaste.
  favicon: { escala: 0.8, grosor: 125, radio: 0.22, halo: 0.55 },
  // Apple y PWA: la F como en la fuente, con el halo completo.
  app: { escala: 0.64, grosor: 90, radio: 0, halo: 1 },
  // "maskable": el dibujo tiene que quedar dentro del 80% central.
  maskable: { escala: 0.5, grosor: 90, radio: 0, halo: 1 },
} as const;

/** Ícono de la app para next/og: la "F" de neón encendida sobre la noche. */
export function IconoApp({ tamano, variante = "app" }: { tamano: number; variante?: Variante }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og necesita <img> */}
      <img src={dataUri(svgF(VARIANTES[variante]))} width={tamano} height={tamano} alt="" />
    </div>
  );
}
