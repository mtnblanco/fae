import { ImageResponse } from "next/og";
import { IconoApp } from "@/components/marca/icono-app";

// 32 px: el tamaño real de la pestaña en pantallas de alta densidad (16 pt × 2).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<IconoApp tamano={32} variante="favicon" />, size);
}
