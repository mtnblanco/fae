import type { MetadataRoute } from "next";
import { sitio } from "@/config/site";
import { RUTAS } from "@/lib/rutas";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${sitio.nombre}: mi carnet`,
    short_name: sitio.nombre,
    description: sitio.descripcion,
    id: "/",
    start_url: RUTAS.login,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#15110e",
    theme_color: "#15110e",
    lang: "es-AR",
    categories: ["lifestyle", "shopping"],
    icons: [
      { src: "/iconos/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
