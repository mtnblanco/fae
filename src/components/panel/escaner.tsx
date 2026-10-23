"use client";

import {
  type IDetectedBarcode,
  type IScannerError,
  Scanner,
  setZXingModuleOverrides,
} from "@yudiel/react-qr-scanner";
import { CameraOff, Check, Gift, Loader2, Plus, ScanLine, Search } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  buscarClienteEscaneado,
  canjearPremio,
  deshacerCorte,
  type EstadoCliente,
} from "@/app/panel/clientes/acciones";
import { Celebracion } from "@/components/carnet/celebracion";
import { GrillaSellos } from "@/components/carnet/sellos";
import { Confirmar } from "@/components/comunes/confirmar";
import { Button } from "@/components/ui/button";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import { useSumarCorte } from "@/hooks/use-sumar-corte";
import { formatearPesos } from "@/lib/dinero";
import { tiempoRelativo } from "@/lib/fechas";
import { calcularProgreso, textoCortes } from "@/lib/progreso";
import { idDesdeQr } from "@/lib/qr";
import { RUTAS, rutaCliente } from "@/lib/rutas";
import { CampoMonto } from "./campo-monto";

// El lector WebAssembly (para iPhone) se sirve desde la app, no desde un CDN.
setZXingModuleOverrides({
  locateFile: (ruta: string, prefijo: string) =>
    ruta.endsWith(".wasm") ? `/vendor/zxing_reader.wasm` : `${prefijo}${ruta}`,
});

const ERRORES_CAMARA: Partial<Record<IScannerError["kind"], string>> = {
  "permission-denied":
    "No tenemos permiso para usar la cámara. Habilitalo en la configuración del navegador.",
  "no-camera": "No encontramos una cámara en este dispositivo.",
  "in-use": "La cámara la está usando otra app. Cerrala y probá de nuevo.",
  "insecure-context": "La cámara solo funciona en una conexión segura (https).",
  unsupported: "Este navegador no permite usar la cámara para escanear.",
};

type Estado =
  | { fase: "escaneando" }
  | { fase: "buscando" }
  | { fase: "cliente"; cliente: EstadoCliente; corteSumado: string | null; nuevos: number }
  | { fase: "error-camara"; mensaje: string };

export function Escaner() {
  const [estado, setEstado] = useState<Estado>({ fase: "escaneando" });
  const [festejo, setFestejo] = useState(0);
  const ultimoInvalido = useRef(0);
  const clienteActual = estado.fase === "cliente" ? estado.cliente : null;
  const sumar = useSumarCorte(clienteActual?.id ?? "", clienteActual?.precio_habitual ?? null);
  const canjear = useAccionUnica();

  async function alEscanear(codigos: IDetectedBarcode[]) {
    if (estado.fase !== "escaneando") return;
    const texto = codigos[0]?.rawValue ?? "";
    const id = idDesdeQr(texto);
    if (!id) {
      // Evita una catarata de avisos mientras el QR equivocado sigue en cámara.
      if (Date.now() - ultimoInvalido.current > 3000) {
        ultimoInvalido.current = Date.now();
        toast.error("Ese QR no es un carnet de la barbería.");
      }
      return;
    }
    setEstado({ fase: "buscando" });
    const r = await buscarClienteEscaneado(id);
    if (r.ok) setEstado({ fase: "cliente", cliente: r.datos, corteSumado: null, nuevos: 0 });
    else {
      toast.error(r.error);
      setEstado({ fase: "escaneando" });
    }
  }

  function alError(error: IScannerError) {
    console.warn("[escáner]", error.kind, error.message, error.cause);
    setEstado({
      fase: "error-camara",
      mensaje: ERRORES_CAMARA[error.kind] ?? "No pudimos abrir la cámara.",
    });
  }

  if (estado.fase === "error-camara") {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-cuero px-6 py-10 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-nogal-claro text-bronce">
          <CameraOff className="size-5" aria-hidden />
        </span>
        <p className="font-titulo text-xl">No pudimos usar la cámara</p>
        <p className="mt-2 max-w-sm text-sm text-arena">{estado.mensaje}</p>
        <div className="mt-6 grid w-full max-w-xs grid-cols-1 gap-2">
          <Button onClick={() => setEstado({ fase: "escaneando" })}>Probar de nuevo</Button>
          <Button asChild variant="outline">
            <Link href={RUTAS.clientes}>
              <Search aria-hidden />
              Buscar al cliente a mano
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (estado.fase === "cliente") {
    const c = estado.cliente;
    const p = calcularProgreso(c);
    const primerNombre = c.nombre.split(" ")[0];

    const alSumar = () =>
      sumar.sumar((datos) => {
        const nuevo = datos.cliente ?? c;
        const completo = nuevo.premios_disponibles > c.premios_disponibles;
        if (completo) setFestejo((n) => n + 1);
        setEstado({ fase: "cliente", cliente: nuevo, corteSumado: datos.corteId, nuevos: 1 });
        toast.success(
          completo ? `¡${primerNombre} completó la tarjeta!` : `Corte sumado a ${primerNombre}`,
          {
            description:
              datos.monto === null ? "Sin monto" : `Cobrado: ${formatearPesos(datos.monto)}`,
            duration: 8000,
            action: {
              label: "Deshacer",
              onClick: async () => {
                const d = await deshacerCorte(datos.corteId);
                if (!d.ok) {
                  toast.error(d.error);
                  return;
                }
                toast.success("Corte deshecho");
                const recargado = await buscarClienteEscaneado(c.id);
                if (recargado.ok)
                  setEstado({
                    fase: "cliente",
                    cliente: recargado.datos,
                    corteSumado: null,
                    nuevos: 0,
                  });
              },
            },
          },
        );
      });

    const alCanjear = () =>
      canjear.ejecutar(async (solicitudId) => {
        const r = await canjearPremio(c.id, solicitudId);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        toast.success("Premio canjeado", { description: r.datos.premio });
        if (r.datos.cliente) setEstado({ ...estado, cliente: r.datos.cliente, nuevos: 0 });
      });

    return (
      <div className="grid grid-cols-1 gap-4" aria-live="polite">
        <Celebracion disparo={festejo} />
        <div className="textura-grano rounded-2xl border border-cuero bg-nogal p-5 shadow-suave">
          <p className="text-sm text-arena">Cliente</p>
          <p className="font-titulo text-[1.75rem] leading-tight text-marfil">{c.nombre}</p>
          <p className="mt-1 text-sm text-arena">
            {c.ultimo_corte
              ? `Último corte ${tiempoRelativo(c.ultimo_corte)}`
              : "Es su primer corte"}
          </p>
          {p.necesarios > 0 ? (
            <>
              <GrillaSellos
                key={`${c.total_cortes}-${c.premios_disponibles}`}
                total={p.necesarios}
                llenos={p.mostrados}
                nuevos={estado.nuevos}
                className="mt-5"
              />
              <p className="mt-4 text-sm text-arena">
                <span className="numeros text-marfil">
                  {p.mostrados} de {p.necesarios}
                </span>
                {p.faltan > 0
                  ? `. Le ${p.faltan === 1 ? "falta" : "faltan"} ${textoCortes(p.faltan)} para el premio.`
                  : ". ¡Tarjeta completa!"}
              </p>
            </>
          ) : null}
          {p.premiosDisponibles > 0 ? (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-bronce/15 px-3 py-1.5 text-sm font-medium text-bronce-claro">
              <Gift className="size-4" aria-hidden />
              {p.premiosDisponibles === 1
                ? "Tiene 1 premio"
                : `Tiene ${p.premiosDisponibles} premios`}
              : {c.descripcion_premio}
            </p>
          ) : null}
        </div>

        {estado.corteSumado ? (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-salvia/10 py-3 text-sm font-medium text-salvia">
            <Check className="size-4" aria-hidden />
            Corte sumado
          </p>
        ) : (
          <>
            <CampoMonto
              valor={sumar.texto}
              onCambio={sumar.cambiar}
              invalido={sumar.invalido}
              sinPrecio={c.precio_habitual === null}
              disabled={sumar.pendiente}
            />
            <Button size="xl" onClick={alSumar} disabled={sumar.pendiente}>
              {sumar.pendiente ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Plus aria-hidden />
              )}
              {sumar.pendiente ? "Sumando…" : "Sumar corte"}
            </Button>
          </>
        )}

        {p.premiosDisponibles > 0 ? (
          <Confirmar
            disparador={
              <Button
                size="xl"
                variant="outline"
                disabled={canjear.pendiente}
                className="border-bronce/50 text-bronce-claro"
              >
                {canjear.pendiente ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Gift aria-hidden />
                )}
                Canjear premio
              </Button>
            }
            titulo="¿Canjear el premio?"
            descripcion={`${primerNombre} va a usar su premio: ${c.descripcion_premio}. No se puede deshacer.`}
            textoConfirmar="Sí, canjear"
            onConfirmar={alCanjear}
          />
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={estado.corteSumado ? "default" : "secondary"}
            onClick={() => setEstado({ fase: "escaneando" })}
          >
            <ScanLine aria-hidden />
            Escanear otro
          </Button>
          <Button asChild variant="outline">
            <Link href={rutaCliente(c.id)}>Ver ficha</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-cuero bg-black">
        <Scanner
          onScan={alEscanear}
          onError={alError}
          formats={["qr_code"]}
          paused={estado.fase !== "escaneando"}
          // Sin mínimos de resolución: los valores por defecto de la librería (≥640 px de alto)
          // fallan con cámaras de 480p. Con "ideal", cada cámara usa lo mejor que tenga.
          constraints={{
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }}
          components={{ finder: false, torch: true }}
          styles={{ container: { width: "100%", height: "100%" }, video: { objectFit: "cover" } }}
          sound={false}
        />
        {/* Visor propio, con las esquinas en bronce */}
        <div aria-hidden className="pointer-events-none absolute inset-[18%]">
          {[
            "top-0 left-0 border-t-4 border-l-4 rounded-tl-xl",
            "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl",
            "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl",
            "bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl",
          ].map((c) => (
            <span key={c} className={`absolute size-10 border-bronce ${c}`} />
          ))}
        </div>
        {estado.fase === "buscando" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-espresso/70">
            <Loader2 className="size-8 animate-spin text-bronce" aria-label="Buscando cliente" />
          </div>
        ) : null}
      </div>
      <p className="text-center text-sm text-arena">Apuntá al QR del carnet del cliente.</p>
      <Button asChild variant="ghost" className="justify-self-center text-arena">
        <Link href={RUTAS.clientes}>
          <Search aria-hidden />
          Buscar al cliente a mano
        </Link>
      </Button>
    </div>
  );
}
