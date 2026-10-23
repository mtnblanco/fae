import { ImageResponse } from "next/og";
import { IconoApp } from "@/components/marca/icono-app";

const ICONOS = {
  "192.png": { tamano: 192, maskable: false },
  "512.png": { tamano: 512, maskable: false },
  "maskable-512.png": { tamano: 512, maskable: true },
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONOS).map((nombre) => ({ nombre }));
}

/** Íconos PNG del manifest (PWA). */
export async function GET(_req: Request, { params }: RouteContext<"/iconos/[nombre]">) {
  const { nombre } = await params;
  const icono = ICONOS[nombre as keyof typeof ICONOS];
  if (!icono) return new Response("No encontrado", { status: 404 });
  return new ImageResponse(
    <IconoApp tamano={icono.tamano} variante={icono.maskable ? "maskable" : "app"} />,
    {
      width: icono.tamano,
      height: icono.tamano,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
