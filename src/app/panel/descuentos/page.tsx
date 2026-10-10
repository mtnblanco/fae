import { BadgePercent, Plus } from "lucide-react";
import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { AccionesDescuento } from "@/components/panel/acciones-descuento";
import { DialogoDescuento } from "@/components/panel/dialogo-descuento";
import { Button } from "@/components/ui/button";
import { listarDescuentos } from "@/lib/datos/panel";
import { estadoDescuento, ETIQUETA_ESTADO } from "@/lib/descuentos";
import { formatearDia, hoyISO } from "@/lib/fechas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Descuentos" };

export default async function PaginaDescuentos() {
  const descuentos = await listarDescuentos();
  const hoy = hoyISO();

  const botonNuevo = (
    <DialogoDescuento
      hoy={hoy}
      disparador={
        <Button>
          <Plus aria-hidden />
          Nuevo descuento
        </Button>
      }
    />
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Descuentos"
        descripcion="Beneficios en comercios amigos. Tus clientes los ven en su carnet mientras estén vigentes."
        acciones={descuentos.length > 0 ? botonNuevo : undefined}
      />
      {descuentos.length === 0 ? (
        <EstadoVacio
          icono={BadgePercent}
          titulo="Todavía no hay descuentos"
          descripcion="Sumá un beneficio de un comercio de la zona: un café, un gimnasio, una casa de ropa. Le da más valor al carnet."
          accion={botonNuevo}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {descuentos.map((d) => {
            const estado = estadoDescuento(d, hoy);
            return (
              <li key={d.id} className="flex flex-col rounded-xl border border-cuero bg-nogal p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-marfil">{d.comercio}</p>
                    <p
                      className={cn(
                        "mt-1 inline-flex items-center gap-1.5 text-[0.8125rem]",
                        estado === "vigente"
                          ? "text-salvia"
                          : estado === "programado"
                            ? "text-bronce"
                            : "text-arena",
                      )}
                    >
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {ETIQUETA_ESTADO[estado]}
                    </p>
                  </div>
                  <AccionesDescuento descuento={d} hoy={hoy} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-arena">{d.descripcion}</p>
                <p className="mt-3 text-[0.8125rem] text-arena">
                  {d.vigente_hasta
                    ? `Del ${formatearDia(d.vigente_desde)} al ${formatearDia(d.vigente_hasta)}`
                    : `Desde el ${formatearDia(d.vigente_desde)}, sin fecha de fin`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
