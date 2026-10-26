import type { Metadata, Viewport } from "next";
import { Gloock, Instrument_Sans, Tilt_Neon } from "next/font/google";
import { connection } from "next/server";
import { Toaster } from "@/components/ui/sonner";
import { IMAGENES_INICIO } from "@/config/pantallas-inicio";
import { sitio, urlDelSitio } from "@/config/site";
import "./globals.css";

const titulo = Gloock({
  variable: "--font-titulo",
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const texto = Instrument_Sans({
  variable: "--font-texto",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  // wdth 85: etiquetas condensadas en mayúsculas sin sumar otra familia.
  axes: ["wdth"],
});

// Tilt Neon: solo para la marca (la "F" y el nombre). Está dibujada como un tubo.
const neon = Tilt_Neon({
  variable: "--font-neon",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(urlDelSitio()),
  title: {
    default: `Club de beneficios | ${sitio.nombreCompleto}`,
    template: `%s | ${sitio.nombre}`,
  },
  description: sitio.descripcion,
  applicationName: sitio.nombre,
  appleWebApp: {
    capable: true,
    title: sitio.nombre,
    statusBarStyle: "black-translucent",
    startupImage: IMAGENES_INICIO,
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: sitio.nombreCompleto,
    title: `Club de beneficios | ${sitio.nombreCompleto}`,
    description: sitio.descripcion,
  },
  twitter: {
    card: "summary_large_image",
    title: `Club de beneficios | ${sitio.nombreCompleto}`,
    description: sitio.descripcion,
  },
};

export const viewport: Viewport = {
  themeColor: "#12100c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Todas las páginas se arman en el pedido: la Content-Security-Policy usa un
  // nonce nuevo cada vez (src/proxy.ts) y Next se lo pone a sus scripts. Una
  // página estática tendría scripts sin nonce y el navegador no los correría.
  await connection();
  return (
    <html
      lang="es-AR"
      suppressHydrationWarning
      className={`dark ${titulo.variable} ${texto.variable} ${neon.variable}`}
    >
      <body className="min-h-dvh">
        {children}
        {/* App instalada en iPhone: la barra de estado es transparente (black-translucent).
            Esta franja del alto de la isla/notch oscurece lo que pasa por debajo al
            scrollear, para que la hora y la batería se lean. En el navegador mide 0. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-[env(safe-area-inset-top)] bg-gradient-to-b from-noche via-noche/90 to-noche/60"
        />
        <Toaster position="top-center" closeButton richColors={false} />
      </body>
    </html>
  );
}
