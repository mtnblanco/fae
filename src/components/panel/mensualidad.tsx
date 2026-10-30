"use client";

import { CalendarCheck, CalendarPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  cobrarMensualidad,
  deshacerCorteMensualidad,
  deshacerMensualidad,
  type EstadoCliente,
  usarCorteMensualidad,
} from "@/app/panel/clientes/acciones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import { textoCobrado } from "@/hooks/use-sumar-corte";
import type { MedioPago } from "@/lib/database.types";
import { MENSAJE_MONTO_INVALIDO, montoParaInput, parsearMonto } from "@/lib/dinero";
import { MENSAJE_FALTA_MEDIO } from "@/lib/medios-pago";
import { CampoMonto } from "./campo-monto";

/** Al cambiar la mensualidad, el estado nuevo del cliente (para el escáner). */
type AlCambiar = (cliente: EstadoCliente | null) => void;

/**
 * "Usar corte de la mensualidad": no cobra ni suma sellos; llena un lugar de
 * la tarjetita. Con el último, el cliente vuelve a ser común.
 */
export function BotonUsarMensualidad({
  cliente,
  quedan,
  alCambiar,
}: {
  cliente: { id: string; nombre: string };
  quedan: number;
  alCambiar?: AlCambiar;
}) {
  const accion = useAccionUnica();
  const primerNombre = cliente.nombre.split(" ")[0];

  function usar() {
    accion.ejecutar(async (solicitudId) => {
      const r = await usarCorteMensualidad(cliente.id, solicitudId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      alCambiar?.(r.datos.cliente);
      const restan = quedan - 1;
      toast.success(`Corte de mensualidad a ${primerNombre}`, {
        description:
          restan > 0
            ? `Le ${restan === 1 ? "queda 1 corte" : `quedan ${restan} cortes`}.`
            : "Usó el último: vuelve a ser cliente común.",
        duration: 8000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const d = await deshacerCorteMensualidad(r.datos.corteId);
            if (!d.ok) {
              toast.error(d.error);
              return;
            }
            toast.success("Corte deshecho");
            alCambiar?.(null);
          },
        },
      });
    });
  }

  return (
    <Button
      size="xl"
      variant="neon"
      onClick={usar}
      disabled={accion.pendiente}
      aria-busy={accion.pendiente || undefined}
    >
      {accion.pendiente ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <CalendarCheck aria-hidden />
      )}
      {accion.pendiente ? "Registrando…" : "Usar corte de la mensualidad"}
    </Button>
  );
}

function FormularioCobro({
  cliente,
  precio,
  alCobrar,
}: {
  cliente: { id: string; nombre: string };
  precio: number | null;
  alCobrar: (cliente: EstadoCliente | null) => void;
}) {
  const accion = useAccionUnica();
  const [texto, setTexto] = useState(() => montoParaInput(precio));
  const [medio, setMedio] = useState<MedioPago | null>(null);
  const [intentado, setIntentado] = useState(false);
  const leido = parsearMonto(texto);
  const montoValido = leido.ok && leido.monto !== null && leido.monto > 0;

  function cobrar() {
    setIntentado(true);
    if (!montoValido) {
      toast.error(leido.ok ? "Escribí cuánto pagó." : MENSAJE_MONTO_INVALIDO);
      return;
    }
    if (!medio) {
      toast.error(MENSAJE_FALTA_MEDIO);
      return;
    }
    const monto = leido.monto;
    accion.ejecutar(async (solicitudId) => {
      const r = await cobrarMensualidad(cliente.id, solicitudId, monto, medio);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      alCobrar(r.datos.cliente);
      toast.success(`Mensualidad cobrada a ${cliente.nombre.split(" ")[0]}`, {
        description: `${textoCobrado(r.datos.monto, medio)}. Tiene 4 cortes.`,
        duration: 8000,
        action: {
          label: "Deshacer",
          onClick: async () => {
            const d = await deshacerMensualidad(r.datos.id);
            if (!d.ok) {
              toast.error(d.error);
              return;
            }
            toast.success("Mensualidad deshecha");
            alCobrar(null);
          },
        },
      });
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <CampoMonto
        valor={texto}
        onCambio={setTexto}
        invalido={intentado && !montoValido}
        nota={
          precio === null
            ? "No tenés precio de mensualidad cargado: cargalo en Servicios para que aparezca solo."
            : undefined
        }
        medio={medio}
        onMedio={setMedio}
        faltaMedio={intentado && !medio}
        disabled={accion.pendiente}
      />
      <Button
        size="lg"
        onClick={cobrar}
        disabled={accion.pendiente}
        aria-busy={accion.pendiente || undefined}
      >
        {accion.pendiente ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {accion.pendiente ? "Cobrando…" : "Cobrar mensualidad"}
      </Button>
    </div>
  );
}

/** "Pagó la mensualidad": cobra el precio del barbero (se puede cambiar) y le da 4 cortes. */
export function DialogoCobrarMensualidad({
  cliente,
  precio,
  alCambiar,
}: {
  cliente: { id: string; nombre: string };
  /** Precio de mensualidad del barbero que cobra. */
  precio: number | null;
  alCambiar?: AlCambiar;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <CalendarPlus aria-hidden />
          Pagó la mensualidad
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">Mensualidad</DialogTitle>
          <DialogDescription>
            {cliente.nombre.split(" ")[0]} paga ahora y tiene 4 cortes, sin vencimiento. Esos cortes
            no suman sellos. Al usar el último vuelve a ser cliente común.
          </DialogDescription>
        </DialogHeader>
        {abierto ? (
          <FormularioCobro
            cliente={cliente}
            precio={precio}
            alCobrar={(c) => {
              setAbierto(false);
              alCambiar?.(c);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
