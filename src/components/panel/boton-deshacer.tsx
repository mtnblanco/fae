"use client";

import { Loader2, Undo2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { deshacerCorte } from "@/app/panel/clientes/acciones";
import { Confirmar } from "@/components/comunes/confirmar";
import { Button } from "@/components/ui/button";

/**
 * "Deshacer" para un corte. Se oculta solo cuando vence el plazo (`vence`, en
 * ms: ver venceDeshacer en lib/permisos).
 */
export function BotonDeshacer({ corteId, vence }: { corteId: string; vence: number }) {
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
      titulo="¿Deshacer este corte?"
      descripcion="Se borra el corte y el cliente pierde ese sello. Usalo solo si lo cargaste por error."
      textoConfirmar="Sí, deshacer"
      destructiva
      onConfirmar={() =>
        startTransition(async () => {
          const r = await deshacerCorte(corteId);
          if (r.ok) toast.success("Corte deshecho");
          else toast.error(r.error);
        })
      }
    />
  );
}
