import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { SelectorBarbero } from "@/components/panel/agenda/selector-barbero";
import { BotonDeshacer } from "@/components/panel/boton-deshacer";
import { FormularioServicioHecho } from "@/components/panel/formulario-servicio-hecho";
import { requireBarbero } from "@/lib/auth";
import { nombresBarberos, serviciosHechosDeHoy } from "@/lib/datos/panel";
import { listarBarberos, serviciosDeBarbero } from "@/lib/datos/turnos";
import { formatearPesos } from "@/lib/dinero";
import { horaInforme } from "@/lib/informe";
import { etiquetaMedio } from "@/lib/medios-pago";
import { venceDeshacer } from "@/lib/permisos";

export const metadata: Metadata = { title: "Registrar servicio" };

export default async function PaginaRegistrar({ searchParams }: PageProps<"/panel/registrar">) {
  const { userId, perfil } = await requireBarbero();
  const sp = await searchParams;

  // Como en Servicios: el empleado carga los suyos; el dueño puede cargarlo por
  // otro barbero (?barbero=). El admin no atiende: arranca por el primero.
  const barberos = perfil.es_dueno ? await listarBarberos() : [];
  const pedido = typeof sp.barbero === "string" ? sp.barbero : userId;
  const barbero =
    (perfil.es_dueno && barberos.find((b) => b.id === pedido)) ||
    (perfil.es_admin ? barberos[0] : { id: userId, nombre: perfil.nombre });

  const [servicios, deHoy, nombres] = await Promise.all([
    barbero ? serviciosDeBarbero(barbero.id, { soloActivos: true }) : Promise.resolve([]),
    serviciosHechosDeHoy(),
    nombresBarberos(),
  ]);
  // eslint-disable-next-line react-hooks/purity -- render del servidor: la hora del request es intencional.
  const ahora = Date.now();

  return (
    <div className="mx-auto grid max-w-xl grid-cols-1 gap-6">
      <EncabezadoPagina
        className="mb-0 sm:mb-0"
        titulo="Registrar servicio"
        descripcion="Para lo que cobrás a alguien que no es cliente registrado. No suma sellos; sí suma en la caja. A los clientes, sumales el corte desde su ficha o escaneando el carnet."
      />

      {perfil.es_dueno && barberos.length > 1 && barbero ? (
        <SelectorBarbero
          parametro="barbero"
          opciones={barberos.map((b) => ({
            valor: b.id,
            etiqueta: b.id === userId ? "Vos" : (b.nombre.split(" ")[0] ?? b.nombre),
          }))}
          elegido={barbero.id}
        />
      ) : null}

      {barbero ? (
        <FormularioServicioHecho
          key={barbero.id}
          barberoId={barbero.id}
          servicios={servicios.map((s) => ({ id: s.id, nombre: s.nombre, precio: s.precio }))}
        />
      ) : (
        <EstadoVacio
          icono={ReceiptText}
          titulo="Todavía no hay barberos"
          descripcion="Cuando haya un barbero cargado, vas a poder registrar sus servicios acá."
        />
      )}

      <section aria-labelledby="titulo-hoy">
        <h2 id="titulo-hoy" className="mb-4 text-2xl">
          {perfil.es_dueno ? "Registrados hoy" : "Tus servicios de hoy"}
        </h2>
        {deHoy.length === 0 ? (
          <p className="rounded-xl border border-hierro bg-ebano px-4 py-3.5 text-sm text-arena">
            Todavía no se registró ningún servicio hoy.
          </p>
        ) : (
          <ul className="divide-y divide-hierro rounded-xl border border-hierro bg-ebano">
            {deHoy.map((h) => {
              const vence = venceDeshacer(perfil, h);
              const quien = h.barbero_id ? nombres[h.barbero_id]?.split(" ")[0] : undefined;
              return (
                <li key={h.id} className="flex items-center">
                  <div className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-marfil">{h.servicio_nombre}</span>
                      <span className="block truncate text-[0.8125rem] text-arena">
                        <time dateTime={h.fecha}>{horaInforme(h.fecha)}</time>
                        {perfil.es_dueno ? ` · ${quien ?? "Sin barbero"}` : ""}
                        {h.nota ? ` · ${h.nota}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="numeros block font-medium whitespace-nowrap text-marfil">
                        {formatearPesos(h.monto)}
                      </span>
                      <span className="block text-[0.75rem] whitespace-nowrap text-arena">
                        {etiquetaMedio(h.medio_pago)}
                      </span>
                    </span>
                  </div>
                  {vence !== null && vence > ahora ? (
                    <span className="shrink-0 pr-2">
                      <BotonDeshacer corteId={h.id} vence={vence} tipo="servicio" />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
