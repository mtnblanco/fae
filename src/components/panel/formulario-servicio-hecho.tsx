"use client";

import { Loader2, Plus } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { deshacerServicioHecho, registrarServicioHecho } from "@/app/panel/registrar/acciones";
import { textoCobrado } from "@/hooks/use-sumar-corte";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import type { MedioPago } from "@/lib/database.types";
import { formatearPesos, MENSAJE_MONTO_INVALIDO, montoParaInput, parsearMonto } from "@/lib/dinero";
import { MENSAJE_FALTA_MEDIO } from "@/lib/medios-pago";
import { cn } from "@/lib/utils";
import { CampoMonto } from "./campo-monto";

type ServicioOpcion = { id: string; nombre: string; precio: number };

/** "Otro": un servicio que no está en la lista, escrito a mano. */
const OTRO = "otro";

/**
 * Servicio cobrado a alguien que no es cliente registrado (no suma sellos):
 * se elige de la lista del barbero (precarga el precio) o se escribe, y se
 * marca cuánto y cómo pagó.
 */
export function FormularioServicioHecho({
  barberoId,
  servicios,
}: {
  barberoId: string;
  servicios: ServicioOpcion[];
}) {
  const id = useId();
  const accion = useAccionUnica();
  const [elegido, setElegido] = useState<string>(servicios[0]?.id ?? OTRO);
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState(() => montoParaInput(servicios[0]?.precio));
  const [medio, setMedio] = useState<MedioPago | null>(null);
  const [nota, setNota] = useState("");
  const [intentado, setIntentado] = useState(false);

  const servicio = servicios.find((s) => s.id === elegido) ?? null;
  const leido = parsearMonto(monto);
  const montoValido = leido.ok && leido.monto !== null && leido.monto > 0;
  const faltaNombre = !servicio && nombre.trim().length < 2;

  function elegir(valor: string) {
    setElegido(valor);
    const s = servicios.find((x) => x.id === valor);
    if (s) setMonto(montoParaInput(s.precio));
  }

  function reiniciar() {
    setNombre("");
    setNota("");
    setMedio(null);
    setIntentado(false);
    setMonto(montoParaInput(servicio?.precio));
  }

  function registrar() {
    setIntentado(true);
    if (faltaNombre) {
      toast.error("Escribí qué servicio hiciste.");
      return;
    }
    if (!montoValido) {
      toast.error(leido.ok ? "Escribí cuánto te pagó." : MENSAJE_MONTO_INVALIDO);
      return;
    }
    if (!medio) {
      toast.error(MENSAJE_FALTA_MEDIO);
      return;
    }
    const datos = {
      barberoId,
      servicioId: servicio?.id ?? null,
      nombre: servicio ? "" : nombre,
      monto: leido.monto,
      medio,
      nota,
    };
    accion.ejecutar(async (solicitudId) => {
      const r = await registrarServicioHecho(datos, solicitudId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      reiniciar();
      toast.success(`${r.datos.nombre} registrado`, {
        description: textoCobrado(r.datos.monto, r.datos.medio),
        duration: 8000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const d = await deshacerServicioHecho(r.datos.id);
            if (d.ok) toast.success("Servicio deshecho");
            else toast.error(d.error);
          },
        },
      });
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-2 text-[0.9375rem] font-medium text-marfil">¿Qué le hiciste?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[...servicios, { id: OTRO, nombre: "Otro", precio: null }].map((s) => {
            const activo = elegido === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={activo}
                disabled={accion.pendiente}
                onClick={() => elegir(s.id)}
                className={cn(
                  "flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left transition-colors",
                  activo
                    ? "border-oro bg-oro/15 text-oro-claro"
                    : "border-hierro-claro text-marfil hover:border-arena/60",
                )}
              >
                <span className="min-w-0 truncate">{s.nombre}</span>
                {s.precio !== null ? (
                  <span className={cn("numeros shrink-0 text-sm", !activo && "text-arena")}>
                    {formatearPesos(s.precio)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {elegido === OTRO ? (
          <div className="mt-2 grid gap-1.5">
            <label htmlFor={`${id}-nombre`} className="text-sm text-arena">
              Servicio
            </label>
            <Input
              id={`${id}-nombre`}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="Por ejemplo: Perfilado de barba"
              aria-invalid={(intentado && faltaNombre) || undefined}
              disabled={accion.pendiente}
              className="h-12"
            />
          </div>
        ) : null}
      </fieldset>

      <CampoMonto
        valor={monto}
        onCambio={setMonto}
        invalido={intentado && !montoValido}
        medio={medio}
        onMedio={setMedio}
        faltaMedio={intentado && !medio}
        disabled={accion.pendiente}
      />

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-nota`} className="text-sm text-arena">
          Nombre o aclaración (opcional)
        </label>
        <Input
          id={`${id}-nota`}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={80}
          autoComplete="off"
          placeholder="Por ejemplo: Pedro, de paso"
          disabled={accion.pendiente}
          className="h-12"
        />
      </div>

      <Button
        size="xl"
        variant="neon"
        onClick={registrar}
        disabled={accion.pendiente}
        aria-busy={accion.pendiente || undefined}
      >
        {accion.pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
        {accion.pendiente ? "Registrando…" : "Registrar servicio"}
      </Button>
    </div>
  );
}
