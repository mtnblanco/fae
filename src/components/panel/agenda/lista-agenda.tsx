"use client";

import { Ban, Check, Loader2, MessageCircle, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  bloquearHorario,
  buscarClientesParaTurno,
  cancelarTurnoAgenda,
  type ClienteEncontrado,
  reservarParaCliente,
} from "@/app/panel/agenda/acciones";
import { Confirmar } from "@/components/comunes/confirmar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import { rutaCliente } from "@/lib/rutas";
import { formatearTelefono, linkWhatsApp } from "@/lib/telefono";
import { cn } from "@/lib/utils";
import { Hoja } from "./hoja";

export type FilaVista = {
  clave: string;
  tipo: "libre" | "reserva" | "bloqueo";
  inicio: string;
  fin: string;
  hora: string;
  horaFin: string;
  turnoId: string | null;
  estado: "reservado" | "atendido" | null;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  nota: string | null;
  barberoId: string;
  /** Solo en la vista "Ambos". */
  barberoNombre: string | null;
};

const primerNombre = (nombre: string | null) => (nombre ?? "").split(" ")[0] ?? "";

/**
 * Lista del día: un renglón por horario, con su hoja de acciones.
 * `dia` es la frase para los mensajes: "de hoy", "de mañana", "del jue 29 de oct".
 */
export function ListaAgenda({ filas, dia }: { filas: FilaVista[]; dia: string }) {
  const [abierta, setAbierta] = useState<FilaVista | null>(null);
  // Si la fila abierta cambió (Realtime), la hoja se cierra sola.
  const vigente = abierta ? filas.find((f) => f.clave === abierta.clave) : null;

  return (
    <>
      <ol className="grid grid-cols-1 gap-2">
        {filas.map((f) => (
          <li key={f.clave} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-stretch gap-3">
            <div className="numeros pt-3 text-right text-[0.9375rem] font-medium text-marfil">
              {f.hora}
            </div>
            <Renglon fila={f} onAbrir={() => setAbierta(f)} />
          </li>
        ))}
      </ol>
      {vigente ? <HojaFila fila={vigente} dia={dia} onCerrar={() => setAbierta(null)} /> : null}
    </>
  );
}

function Renglon({ fila, onAbrir }: { fila: FilaVista; onAbrir: () => void }) {
  const barbero = fila.barberoNombre ? (
    <span className="etiqueta shrink-0 rounded-full border border-hierro px-2 py-0.5 text-arena">
      {primerNombre(fila.barberoNombre)}
    </span>
  ) : null;

  if (fila.tipo === "libre") {
    return (
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-lg border border-dashed border-hierro-claro px-3.5 text-left text-[0.9375rem] text-arena transition-colors hover:border-oro/60 active:bg-ebano-claro"
      >
        <span>Libre</span>
        {barbero}
      </button>
    );
  }

  if (fila.tipo === "bloqueo") {
    return (
      <button
        type="button"
        onClick={onAbrir}
        className="flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-lg bg-ebano-claro/60 bg-[repeating-linear-gradient(135deg,transparent_0_8px,rgb(255_255_255/0.025)_8px_16px)] px-3.5 text-left text-[0.9375rem] text-arena active:bg-ebano-claro"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Ban className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            Bloqueado{fila.nota ? ` · ${fila.nota}` : ""} · hasta {fila.horaFin}
          </span>
        </span>
        {barbero}
      </button>
    );
  }

  const atendido = fila.estado === "atendido";
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={cn(
        "flex min-h-16 min-w-0 items-center justify-between gap-3 rounded-lg border bg-ebano px-3.5 py-2.5 text-left transition-colors active:bg-ebano-claro",
        atendido ? "border-hierro opacity-70" : "border-oro/50 hover:border-oro",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-marfil">{fila.clienteNombre}</span>
        <span className="numeros block text-sm text-arena">
          {atendido ? (
            <span className="inline-flex items-center gap-1 text-exito">
              <Check className="size-3.5" aria-hidden /> Atendido
            </span>
          ) : (
            `${fila.hora} a ${fila.horaFin} · ${formatearTelefono(fila.clienteTelefono)}`
          )}
        </span>
      </span>
      {barbero}
    </button>
  );
}

function HojaFila({ fila, dia, onCerrar }: { fila: FilaVista; dia: string; onCerrar: () => void }) {
  if (fila.tipo === "libre") return <HojaLibre fila={fila} onCerrar={onCerrar} />;
  if (fila.tipo === "bloqueo") return <HojaBloqueo fila={fila} onCerrar={onCerrar} />;
  return <HojaTurno fila={fila} dia={dia} onCerrar={onCerrar} />;
}

function HojaTurno({
  fila,
  dia,
  onCerrar,
}: {
  fila: FilaVista;
  dia: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const { pendiente, ejecutar } = useAccionUnica();
  const [confirmando, setConfirmando] = useState(false);
  const nombre = primerNombre(fila.clienteNombre);
  const telefono = fila.clienteTelefono ?? "";
  const cuando = `${dia} a las ${fila.hora}`;
  const waRecordar = linkWhatsApp(
    telefono,
    `Hola ${nombre}, te escribo de FaeBarberShop por tu turno ${cuando}.`,
  );
  const waCancelar = linkWhatsApp(
    telefono,
    `Hola ${nombre}, tuve que cancelar tu turno ${cuando}. ¿Te queda bien otro horario?`,
  );

  const cancelar = () =>
    ejecutar(async () => {
      const r = await cancelarTurnoAgenda(fila.turnoId!);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      onCerrar();
      toast.success(`Turno de ${nombre} cancelado.`, {
        action: { label: "Avisarle", onClick: () => window.open(waCancelar, "_blank") },
        duration: 10_000,
      });
      router.refresh();
    });

  return (
    <Hoja
      abierta
      onAbiertaChange={(a) => !a && onCerrar()}
      titulo={`${fila.hora} · ${fila.clienteNombre}`}
      descripcion={
        fila.estado === "atendido"
          ? "Atendido: el corte ya está sumado."
          : `${fila.hora} a ${fila.horaFin} · ${formatearTelefono(telefono)}`
      }
    >
      <div className="grid grid-cols-1 gap-2.5">
        <Button asChild variant="oro" size="lg" className="h-12">
          <a href={waRecordar} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            Escribir por WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-12">
          <Link href={rutaCliente(fila.clienteId!)}>
            <UserRound aria-hidden />
            Ver ficha y sumar corte
          </Link>
        </Button>
        {fila.estado === "reservado" ? (
          <Confirmar
            abierto={confirmando}
            onAbiertoChange={setConfirmando}
            disparador={
              <Button variant="destructive" size="lg" className="h-12" disabled={pendiente}>
                {pendiente ? "Cancelando…" : "Cancelar turno"}
              </Button>
            }
            titulo="¿Cancelar este turno?"
            descripcion={`${fila.clienteNombre}, turno ${cuando}. Después podés avisarle por WhatsApp.`}
            textoConfirmar="Sí, cancelar"
            textoCancelar="No"
            destructiva
            onConfirmar={cancelar}
          />
        ) : null}
      </div>
    </Hoja>
  );
}

function HojaBloqueo({ fila, onCerrar }: { fila: FilaVista; onCerrar: () => void }) {
  const router = useRouter();
  const { pendiente, ejecutar } = useAccionUnica();
  const desbloquear = () =>
    ejecutar(async () => {
      const r = await cancelarTurnoAgenda(fila.turnoId!);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      onCerrar();
      toast.success("Horario desbloqueado.");
      router.refresh();
    });
  return (
    <Hoja
      abierta
      onAbiertaChange={(a) => !a && onCerrar()}
      titulo={`Bloqueado de ${fila.hora} a ${fila.horaFin}`}
      descripcion={fila.nota ?? "Nadie puede reservar en este horario."}
    >
      <Button variant="oro" size="lg" className="h-12" onClick={desbloquear} disabled={pendiente}>
        {pendiente ? "Desbloqueando…" : "Desbloquear"}
      </Button>
    </Hoja>
  );
}

function HojaLibre({ fila, onCerrar }: { fila: FilaVista; onCerrar: () => void }) {
  const [modo, setModo] = useState<"elegir" | "reservar" | "bloquear">("elegir");
  return (
    <Hoja
      abierta
      onAbiertaChange={(a) => !a && onCerrar()}
      titulo={`${fila.hora} libre`}
      descripcion={
        modo === "reservar"
          ? "Buscá al cliente por nombre o teléfono."
          : modo === "bloquear"
            ? `Nadie va a poder reservar de ${fila.hora} a ${fila.horaFin}.`
            : `De ${fila.hora} a ${fila.horaFin}${fila.barberoNombre ? ` · ${primerNombre(fila.barberoNombre)}` : ""}.`
      }
    >
      {modo === "elegir" ? (
        <div className="grid grid-cols-1 gap-2.5">
          <Button variant="oro" size="lg" className="h-12" onClick={() => setModo("reservar")}>
            <UserRound aria-hidden />
            Reservar para un cliente
          </Button>
          <Button variant="outline" size="lg" className="h-12" onClick={() => setModo("bloquear")}>
            <Ban aria-hidden />
            Bloquear este horario
          </Button>
        </div>
      ) : modo === "reservar" ? (
        <ReservarParaCliente fila={fila} onListo={onCerrar} />
      ) : (
        <Bloquear fila={fila} onListo={onCerrar} />
      )}
    </Hoja>
  );
}

function ReservarParaCliente({ fila, onListo }: { fila: FilaVista; onListo: () => void }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ClienteEncontrado[] | null>(null);
  const [buscando, startBusqueda] = useTransition();
  const { pendiente, ejecutar } = useAccionUnica();
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  function cambiar(valor: string) {
    setTexto(valor);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      startBusqueda(async () => setResultados(await buscarClientesParaTurno(valor)));
    }, 250);
  }

  const reservar = (c: ClienteEncontrado) =>
    ejecutar(async (solicitudId) => {
      const r = await reservarParaCliente({
        barberoId: fila.barberoId,
        clienteId: c.id,
        clienteNombre: c.nombre,
        inicio: fila.inicio,
        solicitudId,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      onListo();
      toast.success(`Turno de las ${fila.hora} reservado para ${primerNombre(c.nombre)}.`);
      router.refresh();
    });

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-arena"
          aria-hidden
        />
        <Input
          autoFocus
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Nombre o teléfono"
          aria-label="Buscar cliente"
          value={texto}
          onChange={(e) => cambiar(e.target.value)}
          className="h-12 pl-10"
        />
        {buscando ? (
          <Loader2
            className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-arena"
            aria-hidden
          />
        ) : null}
      </div>
      {resultados && resultados.length === 0 && !buscando ? (
        <p className="text-sm text-arena">
          No encontramos a nadie con &quot;{texto}&quot;. Si es nuevo, primero dalo de alta en
          Clientes.
        </p>
      ) : null}
      {resultados && resultados.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1.5" aria-label="Clientes encontrados">
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => reservar(c)}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-hierro px-3.5 py-2 text-left transition-colors hover:border-oro/60 active:bg-ebano-alto disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-marfil">{c.nombre}</span>
                  <span className="numeros block text-sm text-arena">
                    {formatearTelefono(c.telefono)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-oro">
                  {pendiente ? "Reservando…" : "Reservar"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Bloquear({ fila, onListo }: { fila: FilaVista; onListo: () => void }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const { pendiente, ejecutar } = useAccionUnica();
  const bloquear = () =>
    ejecutar(async (solicitudId) => {
      const r = await bloquearHorario({
        barberoId: fila.barberoId,
        inicio: fila.inicio,
        fin: fila.fin,
        nota,
        solicitudId,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      onListo();
      toast.success(`Horario de las ${fila.hora} bloqueado.`);
      router.refresh();
    });
  return (
    <form
      className="grid grid-cols-1 gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        bloquear();
      }}
    >
      <Input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        maxLength={120}
        placeholder="Motivo (opcional): trámite, almuerzo…"
        aria-label="Motivo del bloqueo (opcional)"
        className="h-12"
      />
      <Button type="submit" size="lg" className="h-12" disabled={pendiente}>
        {pendiente ? "Bloqueando…" : "Bloquear horario"}
      </Button>
    </form>
  );
}
