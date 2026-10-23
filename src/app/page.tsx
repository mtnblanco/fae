import { ArrowRight, AtSign, MapPin, MessageCircle, QrCode, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { GrillaSellos } from "@/components/carnet/sellos";
import { Logo } from "@/components/marca/logo";
import { Button } from "@/components/ui/button";
import { sitio } from "@/config/site";
import { reglaPublica } from "@/lib/datos/publico";
import { RUTAS } from "@/lib/rutas";

// La regla puede cambiar desde el panel: se revisa cada hora (y al guardarla).
export const revalidate = 3600;

const PASOS = [
  {
    icono: UserRound,
    titulo: "Te damos de alta",
    texto: "En tu próximo corte te creamos el carnet. Entrás con tu teléfono y una contraseña.",
  },
  {
    icono: QrCode,
    titulo: "Mostrás tu QR",
    texto: "Cada vez que venís, escaneamos tu código y se estampa un sello en tu tarjeta.",
  },
  {
    icono: Store,
    titulo: "Disfrutás los premios",
    texto: "Completás la tarjeta y ganás tu premio. Además, tenés descuentos en comercios amigos.",
  },
];

export default async function Inicio() {
  const regla = await reglaPublica();
  const n = regla.cortes_necesarios;
  const demoLlenos = Math.max(1, Math.min(n - 1, Math.ceil(n * 0.6)));

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <div
        aria-hidden
        className="textura-grano pointer-events-none absolute inset-0 -z-10 opacity-50"
      />
      {/* La pared: ladrillo casi invisible que se apaga hacia abajo. */}
      <div
        aria-hidden
        className="textura-ladrillo pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      <header className="contenedor flex h-16 items-center justify-between sm:h-20">
        <Logo tamano="sm" />
        <Button asChild variant="oro" size="sm">
          <Link href={RUTAS.login}>Ingresar</Link>
        </Button>
      </header>

      <main id="contenido">
        <section className="pared-iluminada contenedor grid grid-cols-1 items-center gap-12 pt-8 pb-20 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20 lg:pb-28">
          <div>
            <p className="etiqueta text-oro">Club de beneficios de {sitio.nombreCompleto}</p>
            <h1 className="mt-4 text-[clamp(3rem,13vw,5.25rem)] leading-[0.98] tracking-[-0.015em] text-marfil">
              Cada corte <span className="neon block">suma.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-arena">
              Juntá {n} sellos y llevate{" "}
              <span className="text-marfil">{regla.descripcion_premio.toLowerCase()}</span>. Tu
              carnet vive en el celular: sin tarjetas de cartón que se pierden.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button asChild size="xl" variant="neon">
                <Link href={RUTAS.login}>
                  Ingresar a mi carnet
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <p className="text-sm text-arena">¿Todavía no tenés? Pedíselo a tu barbero.</p>
            </div>
          </div>

          {/* El carnet de muestra: el protagonista de la página. */}
          <div className="relative mx-auto w-full max-w-[22rem] lg:max-w-[26rem]" aria-hidden>
            <div className="textura-grano relative rotate-[-4deg] overflow-hidden rounded-[1.375rem] bg-ebano p-6 shadow-carnet sm:p-7">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_70%_at_15%_0%,rgb(255_190_30/0.08),transparent_60%)]" />
              <div className="pointer-events-none absolute inset-2.5 rounded-[1rem] border border-oro/30" />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <Logo tamano="sm" />
                  <span className="text-right text-[0.6875rem] leading-tight text-arena">
                    Socio n.º <span className="text-marfil">00127</span>
                    <br />
                    desde {new Date().getFullYear()}
                  </span>
                </div>
                <p className="mt-16 font-titulo text-[2rem] leading-none sm:mt-20">Tu nombre</p>
                <GrillaSellos
                  total={n}
                  llenos={demoLlenos}
                  nuevos={demoLlenos}
                  tamano="lg"
                  className="mt-5"
                />
                <p className="mt-4 text-sm text-arena">
                  {demoLlenos} de {n}. Te faltan {n - demoLlenos} para el premio.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="titulo-como" className="border-t border-hierro bg-ebano/40">
          <div className="contenedor py-16 sm:py-20">
            <div aria-hidden className="filete mb-6 w-14" />
            <h2 id="titulo-como" className="text-4xl sm:text-5xl">
              Cómo funciona
            </h2>
            <ol className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
              {PASOS.map((paso, i) => {
                const Icono = paso.icono;
                return (
                  <li key={paso.titulo} className="grid grid-cols-1 content-start gap-3">
                    <span className="flex items-center gap-3">
                      <span className="font-titulo text-4xl leading-none text-oro">{i + 1}</span>
                      <Icono className="size-5 text-arena" strokeWidth={1.75} aria-hidden />
                    </span>
                    <h3 className="text-2xl text-marfil">{paso.titulo}</h3>
                    <p className="max-w-xs leading-relaxed text-arena">{paso.texto}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </main>

      <footer className="contenedor grid grid-cols-1 gap-6 border-t border-hierro py-10 text-sm text-arena sm:grid-cols-[auto_1fr_auto] sm:items-start sm:gap-10">
        <Logo tamano="sm" />
        <div className="grid grid-cols-1 gap-2">
          <p className="text-marfil">
            {sitio.nombreCompleto}, {sitio.ciudad}
            {sitio.horarios ? `. ${sitio.horarios}` : ""}
          </p>
          {sitio.sedes.length > 0 && (
            <ul className="grid grid-cols-1 gap-1.5">
              {sitio.sedes.map((sede) => (
                <li key={sede} className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-oro" aria-hidden />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${sede}, ${sitio.ciudad}, Buenos Aires`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 hover:text-marfil hover:underline"
                  >
                    {sede}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ul className="grid grid-cols-1 gap-1.5">
          {sitio.whatsapp && (
            <li>
              <a
                href={`https://wa.me/${sitio.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:text-marfil hover:underline sm:min-h-0"
              >
                <MessageCircle className="size-4 shrink-0 text-oro" aria-hidden />
                Reservá tu turno por WhatsApp
              </a>
            </li>
          )}
          {sitio.instagram && (
            <li>
              <a
                href={`https://www.instagram.com/${sitio.instagram}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:text-marfil hover:underline sm:min-h-0"
              >
                <AtSign className="size-4 shrink-0 text-oro" aria-hidden />
                {sitio.instagram} en Instagram
              </a>
            </li>
          )}
        </ul>
      </footer>
    </div>
  );
}
