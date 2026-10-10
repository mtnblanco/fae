"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cambiarActivoDescuento, eliminarDescuento } from "@/app/panel/descuentos/acciones";
import { Confirmar } from "@/components/comunes/confirmar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Descuento } from "@/lib/database.types";
import { DialogoDescuento } from "./dialogo-descuento";

export function AccionesDescuento({ descuento, hoy }: { descuento: Descuento; hoy: string }) {
  const [pendiente, startTransition] = useTransition();
  const [activo, setActivoOptimista] = useOptimistic(descuento.activo);

  return (
    <div className="flex items-center gap-1">
      <Switch
        checked={activo}
        disabled={pendiente}
        aria-label={activo ? `Pausar ${descuento.comercio}` : `Activar ${descuento.comercio}`}
        onCheckedChange={(v) =>
          startTransition(async () => {
            setActivoOptimista(v);
            const r = await cambiarActivoDescuento(descuento.id, v);
            if (r.ok) toast.success(v ? "Descuento activado" : "Descuento pausado");
            else toast.error(r.error);
          })
        }
        className="mr-2"
      />
      <DialogoDescuento
        descuento={descuento}
        hoy={hoy}
        disparador={
          <Button variant="ghost" size="icon" aria-label={`Editar ${descuento.comercio}`}>
            <Pencil aria-hidden />
          </Button>
        }
      />
      <Confirmar
        disparador={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Eliminar ${descuento.comercio}`}
            disabled={pendiente}
          >
            <Trash2 aria-hidden />
          </Button>
        }
        titulo="¿Eliminar este descuento?"
        descripcion={`Se borra el beneficio de ${descuento.comercio}. Si solo querés ocultarlo por un tiempo, pausalo.`}
        textoConfirmar="Eliminar"
        destructiva
        onConfirmar={() =>
          startTransition(async () => {
            const r = await eliminarDescuento(descuento.id);
            if (r.ok) toast.success("Descuento eliminado");
            else toast.error(r.error);
          })
        }
      />
    </div>
  );
}
