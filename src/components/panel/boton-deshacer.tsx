"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deshacerCorte,
  deshacerCorteMensualidad,
  deshacerMensualidad,
} from "@/app/panel/clientes/acciones";
import { deshacerServicioHecho } from "@/app/panel/registrar/acciones";
import { Confirmar } from "@/components/comunes/confirmar";
import { Button } from "@/components/ui/button";

const TEXTOS = {
  corte: {
    titulo: "¿Deshacer este corte?",
    descripcion:
      "Se borra el corte y el cliente pierde ese sello. Usalo solo si lo cargaste por error.",
    hecho: "Corte deshecho",
  },
  servicio: {
    titulo: "¿Deshacer este servicio?",
    descripcion:
      "Se borra el servicio y deja de sumar en la caja. Usalo solo si lo cargaste por error.",
    hecho: "Servicio deshecho",
  },
  mensual: {
    titulo: "¿Deshacer este corte de mensualidad?",
    descripcion:
      "El corte vuelve a la mensualidad del cliente. Usalo solo si lo cargaste por error.",
    hecho: "Corte deshecho",
  },
  mensualidad: {
    titulo: "¿Deshacer esta mensualidad?",
    descripcion:
      "Se borra el cobro y el cliente vuelve a ser común. Solo se puede si todavía no usó ningún corte.",
    hecho: "Mensualidad deshecha",
  },
} as const;

const DESHACER = {
  corte: deshacerCorte,
  servicio: deshacerServicioHecho,
  mensual: deshacerCorteMensualidad,
  mensualidad: deshacerMensualidad,
} as const;

/**
 * "Deshacer" para un corte o un servicio sin cliente. Se oculta solo cuando
 * vence el plazo (`vence`, en ms: ver venceDeshacer en lib/permisos).
 */
export function BotonDeshacer({
  corteId,
  vence,
  tipo = "corte",
}: {
  /** Id del corte (o del servicio sin cliente, la mensualidad… según `tipo`). */
  corteId: string;
  vence: number;
  tipo?: keyof typeof TEXTOS;
}) {
  const textos = TEXTOS[tipo];
  const [vigente, setVigente] = useState(true);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    const restante = vence - Date.now();
    // setTimeout no admite más de ~24 días; el plazo nunca pasa de un día.
    const t = setTimeout(() => setVigente(false), Math.max(0, restante));
    return () => clearTimeout(t);
  }, [vence]);

  if (!vigente) return null;

  return (
    <Confirmar
      disparador={
        <Button
          variant="ghost"
          size="sm"
          disabled={pendiente}
          className="text-arena hover:text-marfil"
        >
          {pendiente ? <Loader2 className="animate-spin" aria-hidden /> : <Undo2 aria-hidden />}
          Deshacer
        </Button>
      }
      titulo={textos.titulo}
      descripcion={textos.descripcion}
      textoConfirmar="Sí, deshacer"
      destructiva
      onConfirmar={() =>
        startTransition(async () => {
          const r = await DESHACER[tipo](corteId);
          if (r.ok) toast.success(textos.hecho);
          else toast.error(r.error);
        })
      }
    />
  );
}
