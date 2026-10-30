"use client";

import { useState } from "react";
import { toast } from "sonner";
import { sumarCorte } from "@/app/panel/clientes/acciones";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import type { MedioPago } from "@/lib/database.types";
import { formatearPesos, MENSAJE_MONTO_INVALIDO, montoParaInput, parsearMonto } from "@/lib/dinero";
import { ETIQUETAS_MEDIO, MENSAJE_FALTA_MEDIO } from "@/lib/medios-pago";

/** Para el aviso: "Cobrado: $ 8.000 (efectivo)", o "Sin monto". */
export function textoCobrado(monto: number | null, medio: MedioPago | null): string {
  if (monto === null) return "Sin monto";
  const como = medio ? ` (${ETIQUETAS_MEDIO[medio].toLowerCase()})` : "";
  return `Cobrado: ${formatearPesos(monto)}${como}`;
}

type Sumado = Extract<Awaited<ReturnType<typeof sumarCorte>>, { ok: true }>["datos"];

/**
 * Estado del monto a cobrar (precargado con el precio habitual del cliente),
 * del medio de pago y la acción de sumar el corte. El precio ya está: falta
 * marcar efectivo o transferencia (si hay algo que cobrar).
 */
export function useSumarCorte(clienteId: string, precioHabitual: number | null) {
  const accion = useAccionUnica();
  const [texto, setTexto] = useState(() => montoParaInput(precioHabitual));
  const [invalido, setInvalido] = useState(false);
  const [medio, setMedio] = useState<MedioPago | null>(null);
  const [faltaMedio, setFaltaMedio] = useState(false);

  // Si cambia el cliente o su precio (lo editó el dueño), se vuelve a precargar.
  const clave = `${clienteId}:${precioHabitual}`;
  const [claveAnterior, setClaveAnterior] = useState(clave);
  if (clave !== claveAnterior) {
    setClaveAnterior(clave);
    setTexto(montoParaInput(precioHabitual));
    setInvalido(false);
    setMedio(null);
    setFaltaMedio(false);
  }

  const leido = parsearMonto(texto);

  function cambiar(valor: string) {
    setTexto(valor);
    if (invalido) setInvalido(!parsearMonto(valor).ok);
  }

  function sumar(alSumar: (datos: Sumado) => void) {
    if (!leido.ok) {
      setInvalido(true);
      toast.error(MENSAJE_MONTO_INVALIDO);
      return;
    }
    const monto = leido.monto;
    // Sin cobro (vacío o $ 0) no hay medio de pago.
    const cobra = monto !== null && monto > 0;
    if (cobra && !medio) {
      setFaltaMedio(true);
      toast.error(MENSAJE_FALTA_MEDIO);
      return;
    }
    const medioCobrado = cobra ? medio : null;
    accion.ejecutar(async (solicitudId) => {
      const r = await sumarCorte(clienteId, solicitudId, monto, medioCobrado);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setTexto(montoParaInput(precioHabitual));
      setMedio(null);
      setFaltaMedio(false);
      alSumar(r.datos);
    });
  }

  return {
    texto,
    cambiar,
    invalido,
    medio,
    elegirMedio: setMedio,
    faltaMedio,
    /** Monto que se va a guardar (null = sin monto o todavía mal escrito). */
    monto: leido.ok ? leido.monto : null,
    pendiente: accion.pendiente,
    sumar,
  };
}
