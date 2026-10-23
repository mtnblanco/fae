"use client";

import { useState } from "react";
import { toast } from "sonner";
import { sumarCorte } from "@/app/panel/clientes/acciones";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import { MENSAJE_MONTO_INVALIDO, montoParaInput, parsearMonto } from "@/lib/dinero";

type Sumado = Extract<Awaited<ReturnType<typeof sumarCorte>>, { ok: true }>["datos"];

/**
 * Estado del monto a cobrar (precargado con el precio habitual del cliente) y
 * la acción de sumar el corte con ese monto. Un solo toque: el precio ya está.
 */
export function useSumarCorte(clienteId: string, precioHabitual: number | null) {
  const accion = useAccionUnica();
  const [texto, setTexto] = useState(() => montoParaInput(precioHabitual));
  const [invalido, setInvalido] = useState(false);

  // Si cambia el cliente o su precio (lo editó el dueño), se vuelve a precargar.
  const clave = `${clienteId}:${precioHabitual}`;
  const [claveAnterior, setClaveAnterior] = useState(clave);
  if (clave !== claveAnterior) {
    setClaveAnterior(clave);
    setTexto(montoParaInput(precioHabitual));
    setInvalido(false);
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
    accion.ejecutar(async (solicitudId) => {
      const r = await sumarCorte(clienteId, solicitudId, monto);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setTexto(montoParaInput(precioHabitual));
      alSumar(r.datos);
    });
  }

  return {
    texto,
    cambiar,
    invalido,
    /** Monto que se va a guardar (null = sin monto o todavía mal escrito). */
    monto: leido.ok ? leido.monto : null,
    pendiente: accion.pendiente,
    sumar,
  };
}
