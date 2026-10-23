import type { Metadata, Viewport } from "next";
import { Gloock, Instrument_Sans, Tilt_Neon } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      suppressHydrationWarning
      className={`dark ${titulo.variable} ${texto.variable} ${neon.variable}`}
    >
      <body className="min-h-dvh">
        {children}
        <Toaster position="top-center" closeButton richColors={false} />
      </body>
    </html>
  );
}
