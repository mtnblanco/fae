import type { MetadataRoute } from "next";
import { sitio } from "@/config/site";
import { RUTAS } from "@/lib/rutas";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${sitio.nombre}: mi carnet`,
    short_name: sitio.nombre,
    description: sitio.descripcion,
    id: "/",
    // ?app: si quien abre es barbero, el proxy lo lleva directo a la agenda.
    start_url: `${RUTAS.login}?app`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12100c",
    theme_color: "#12100c",
    lang: "es-AR",
    categories: ["lifestyle", "shopping"],
    shortcuts: [
      { name: "Sacar turno", short_name: "Turnos", url: RUTAS.turnos },
      { name: "Agenda del día", short_name: "Agenda", url: RUTAS.agenda },
    ],
    icons: [
      { src: "/iconos/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
