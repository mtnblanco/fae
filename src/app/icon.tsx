import { ImageResponse } from "next/og";
import { IconoApp } from "@/components/marca/icono-app";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<IconoApp tamano={64} />, size);
}
