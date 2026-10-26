"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { activarServicio, borrarServicio } from "@/app/panel/agenda/servicios/acciones";
import { Confirmar } from "@/components/comunes/confirmar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Servicio } from "@/lib/database.types";
import { DialogoServicio } from "./dialogo-servicio";

/** Pausar/activar, editar y borrar un servicio (como los descuentos). */
export function AccionesServicio({ servicio }: { servicio: Servicio }) {
  const [pendiente, startTransition] = useTransition();
  const [activo, setActivoOptimista] = useOptimistic(servicio.activo);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Switch
        checked={activo}
        disabled={pendiente}
        aria-label={activo ? `Pausar ${servicio.nombre}` : `Ofrecer ${servicio.nombre}`}
        onCheckedChange={(v) =>
          startTransition(async () => {
            setActivoOptimista(v);
            const r = await activarServicio(servicio.id, v);
            if (r.ok) toast.success(v ? "Servicio activo" : "Servicio pausado");
            else toast.error(r.error);
          })
        }
        className="mr-2"
      />
      <DialogoServicio
        barberoId={servicio.barbero_id}
        servicio={servicio}
        disparador={
          <Button variant="ghost" size="icon" aria-label={`Editar ${servicio.nombre}`}>
            <Pencil aria-hidden />
          </Button>
        }
      />
      <Confirmar
        disparador={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Borrar ${servicio.nombre}`}
            disabled={pendiente}
          >
            <Trash2 aria-hidden />
          </Button>
        }
        titulo="¿Borrar este servicio?"
        descripcion={`Se borra ${servicio.nombre}. Los turnos ya reservados lo mantienen con su precio. Si solo querés dejar de ofrecerlo por un tiempo, pausalo.`}
        textoConfirmar="Borrar"
        destructiva
        onConfirmar={() =>
          startTransition(async () => {
            const r = await borrarServicio(servicio.id);
            if (r.ok) toast.success("Servicio borrado");
            else toast.error(r.error);
          })
        }
      />
    </div>
  );
}
