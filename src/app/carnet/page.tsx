import { Gift, Scissors, Store } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { Suspense } from "react";
import { ActualizadorCarnet } from "@/components/carnet/actualizador-carnet";
import { Bienvenida } from "@/components/carnet/bienvenida";
import { TarjetaCarnet } from "@/components/carnet/tarjeta-carnet";
import { EstadoVacio } from "@/components/comunes/estado-vacio";
import { TurnoCarnet } from "@/components/turnos/turno-carnet";
import { HistorialCliente } from "@/components/panel/historial-cliente";
import { urlDelSitio } from "@/config/site";
import { requireCliente } from "@/lib/auth";
import { datosCarnet } from "@/lib/datos/carnet";
import { anioDe, formatearDia } from "@/lib/fechas";
import { RUTAS, rutaCliente } from "@/lib/rutas";

/** Número de socio corto y estable, derivado del id (solo decorativo). */
function numeroDeSocio(id: string) {
  return String(Number.parseInt(id.replace(/-/g, "").slice(-6), 16) % 100000).padStart(5, "0");
}

export default async function PaginaCarnet() {
  const { userId, perfil } = await requireCliente();
  const datos = await datosCarnet(userId);
  if (!datos) throw new Error("No encontramos tu carnet.");

  const { cliente, cortes, canjes, descuentos } = datos;
  // El QR lleva a la ficha del cliente en el panel: el escáner extrae el id,
  // y si el barbero usa la cámara común del celular, también abre la ficha.
  const qrSvg = await QRCode.toString(`${urlDelSitio()}${rutaCliente(cliente.id)}`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#12100c", light: "#00000000" },
  });
  const nombre = perfil.nombre.split(" ")[0] ?? perfil.nombre;
  // eslint-disable-next-line react-hooks/purity -- render del servidor: la hora del request es intencional.
  const ahora = Date.now();

  return (
    <div className="grid grid-cols-1 gap-10">
      <h1 className="sr-only">Mi carnet de {cliente.nombre}</h1>
      <Suspense>
        <Bienvenida nombre={nombre} />
      </Suspense>
      <ActualizadorCarnet clienteId={cliente.id} cortesIds={cortes.slice(0, 20).map((c) => c.id)} />

      <TarjetaCarnet
        cliente={cliente}
        socioDesde={anioDe(cliente.created_at)}
        numeroSocio={numeroDeSocio(cliente.id)}
        qrSvg={qrSvg}
      />

      <TurnoCarnet cliente={perfil.nombre} />

      <section aria-labelledby="titulo-premios" className="grid grid-cols-1 gap-4">
        <h2 id="titulo-premios" className="text-2xl">
          Tus premios
        </h2>
        {cliente.premios_disponibles > 0 ? (
          <div className="flex gap-4 rounded-xl border border-oro/40 bg-oro/10 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-oro text-primary-foreground">
              <Gift className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-titulo text-xl text-marfil">
                {cliente.premios_disponibles === 1
                  ? "Tenés un premio para usar"
                  : `Tenés ${cliente.premios_disponibles} premios para usar`}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-arena">
                {cliente.descripcion_premio}. Avisale a tu barbero en tu próximo corte y te lo
                descuenta.
              </p>
            </div>
          </div>
        ) : null}
        {cliente.cortes_necesarios ? (
          <p className="text-[0.9375rem] leading-relaxed text-arena">
            Cada <span className="text-marfil">{cliente.cortes_necesarios} cortes</span> ganás{" "}
            <span className="text-marfil">{cliente.descripcion_premio?.toLowerCase()}</span>. Tu
            barbero te suma un sello cada vez que venís.
            {cliente.total_canjes > 0
              ? ` Ya usaste ${cliente.total_canjes === 1 ? "1 premio" : `${cliente.total_canjes} premios`}.`
              : ""}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="titulo-descuentos" className="grid grid-cols-1 gap-4">
        <div>
          <h2 id="titulo-descuentos" className="text-2xl">
            Beneficios en comercios amigos
          </h2>
          <p className="mt-1 text-sm text-arena">Mostrá tu carnet para aprovecharlos.</p>
        </div>
        {descuentos.length === 0 ? (
          <EstadoVacio
            icono={Store}
            titulo="Pronto vas a tener beneficios"
            descripcion="Estamos sumando comercios de la zona con descuentos para los clientes de la barbería."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {descuentos.map((d) => (
              <li key={d.id} className="rounded-xl border border-hierro bg-ebano p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ebano-claro text-oro">
                    <Store className="size-[1.125rem]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-marfil">{d.comercio}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-arena">{d.descripcion}</p>
                    {d.vigente_hasta ? (
                      <p className="mt-2 text-[0.8125rem] text-oro">
                        Hasta el {formatearDia(d.vigente_hasta)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-historial" className="grid grid-cols-1 gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="titulo-historial" className="text-2xl">
            Tus cortes
          </h2>
          {cortes.length > 0 ? (
            <p className="numeros text-sm text-arena">
              {cortes.length === 1 ? "1 en total" : `${cortes.length} en total`}
            </p>
          ) : null}
        </div>
        {cortes.length === 0 && canjes.length === 0 ? (
          <EstadoVacio
            icono={Scissors}
            titulo="Tu primer sello te espera"
            descripcion="En tu próximo corte mostrale el QR a tu barbero y vas a ver el sello aparecer en la tarjeta."
          />
        ) : (
          <HistorialCliente cortes={cortes} canjes={canjes} ahora={ahora} />
        )}
      </section>

      <footer className="border-t border-hierro pt-6 text-center">
        <Link
          href={RUTAS.cambiarPassword}
          className="rounded-md text-sm text-arena underline-offset-4 transition-colors hover:text-marfil hover:underline"
        >
          Cambiar mi contraseña
        </Link>
      </footer>
    </div>
  );
}
