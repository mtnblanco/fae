"use client";

import { CalendarOff, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { borrarDiaEspecial, guardarDiaEspecial } from "@/app/panel/agenda/acciones";
import { Confirmar } from "@/components/comunes/confirmar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import type { DiaEspecialAgrupado } from "@/lib/datos/turnos";
import { diaDeLaSemana, etiquetaDia, sumarDias } from "@/lib/turnos/fechas";
import { type Franja, type FranjaSemanal, problemaFranjas } from "@/lib/turnos/franjas";
import { cn } from "@/lib/utils";
import { EditorFranjas } from "./editor-franjas";
import { Hoja } from "./hoja";

/** Días especiales: cerrado u horario distinto en una fecha puntual. */
export function DiasEspeciales({
  barberoId,
  dias,
  semanal,
  hoy,
}: {
  barberoId: string;
  dias: DiaEspecialAgrupado[];
  semanal: FranjaSemanal[];
  hoy: string;
}) {
  const [agregando, setAgregando] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-3">
      {dias.length === 0 ? (
        <p className="text-sm leading-relaxed text-arena">
          Para un feriado, un día libre o un horario distinto en una fecha puntual.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {dias.map((d) => (
            <FilaDiaEspecial key={d.fecha} barberoId={barberoId} dia={d} hoy={hoy} />
          ))}
        </ul>
      )}
      <Button variant="oro" className="h-12 w-full sm:w-fit" onClick={() => setAgregando(true)}>
        <Plus aria-hidden />
        Agregar día especial
      </Button>
      {agregando ? (
        <NuevoDiaEspecial
          barberoId={barberoId}
          semanal={semanal}
          hoy={hoy}
          onCerrar={() => setAgregando(false)}
        />
      ) : null}
    </div>
  );
}

function FilaDiaEspecial({
  barberoId,
  dia,
  hoy,
}: {
  barberoId: string;
  dia: DiaEspecialAgrupado;
  hoy: string;
}) {
  const router = useRouter();
  const { pendiente, ejecutar } = useAccionUnica();
  const detalle = dia.cerrado
    ? "Cerrado"
    : dia.franjas.map((f) => `${f.desde} a ${f.hasta} (${f.duracion_min} min)`).join(" · ");
  const borrar = () =>
    ejecutar(async () => {
      const r = await borrarDiaEspecial(barberoId, dia.fecha);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Listo: ese día vuelve al horario de siempre.");
      router.refresh();
    });
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-hierro bg-ebano py-2.5 pr-1.5 pl-3.5">
      <div className="min-w-0">
        <p className="font-medium text-marfil">{etiquetaDia(dia.fecha, hoy)}</p>
        <p className={cn("numeros text-sm", dia.cerrado ? "text-oro" : "text-arena")}>
          {detalle}
          {dia.motivo ? <span className="text-arena"> · {dia.motivo}</span> : null}
        </p>
      </div>
      <Confirmar
        disparador={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Quitar el día especial ${etiquetaDia(dia.fecha, hoy)}`}
            disabled={pendiente}
          >
            <X aria-hidden />
          </Button>
        }
        titulo="¿Quitar este día especial?"
        descripcion={`${etiquetaDia(dia.fecha, hoy)} vuelve al horario de todas las semanas.`}
        textoConfirmar="Quitar"
        onConfirmar={borrar}
      />
    </li>
  );
}

function NuevoDiaEspecial({
  barberoId,
  semanal,
  hoy,
  onCerrar,
}: {
  barberoId: string;
  semanal: FranjaSemanal[];
  hoy: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState("");
  const [cerrado, setCerrado] = useState(true);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [motivo, setMotivo] = useState("");
  const { pendiente, ejecutar } = useAccionUnica();

  // Como Cal.com: el horario distinto arranca con el habitual de ese día de la semana.
  const habitual = (f: string): Franja[] =>
    semanal
      .filter((s) => s.dia_semana === diaDeLaSemana(f))
      .map(({ desde, hasta, duracion_min }) => ({ desde, hasta, duracion_min }));

  function elegirFecha(f: string) {
    setFecha(f);
    if (!cerrado && f) setFranjas(habitual(f));
  }

  function elegirModo(esCerrado: boolean) {
    setCerrado(esCerrado);
    if (!esCerrado && franjas.length === 0) {
      const h = fecha ? habitual(fecha) : [];
      setFranjas(h.length > 0 ? h : [{ desde: "10:00", hasta: "13:00", duracion_min: 30 }]);
    }
  }

  const problema = cerrado
    ? null
    : franjas.length === 0
      ? "Agregá al menos una franja."
      : problemaFranjas(franjas);

  const guardar = () =>
    ejecutar(async () => {
      const r = await guardarDiaEspecial({
        barberoId,
        fecha,
        franjas: cerrado ? [] : franjas,
        motivo,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        cerrado ? "Listo: ese día no se dan turnos." : "Listo: ese día tiene su propio horario.",
      );
      onCerrar();
      router.refresh();
    });

  return (
    <Hoja
      abierta
      onAbiertaChange={(a) => !a && onCerrar()}
      titulo="Día especial"
      descripcion="Los turnos que ya estén reservados ese día no se tocan."
    >
      <form
        className="grid grid-cols-1 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="dia-especial-fecha">Fecha</Label>
          <Input
            id="dia-especial-fecha"
            type="date"
            required
            min={hoy}
            max={sumarDias(hoy, 365)}
            value={fecha}
            onChange={(e) => elegirFecha(e.target.value)}
            className="h-12"
          />
        </div>

        <div
          role="group"
          aria-label="Ese día"
          className="grid grid-cols-2 gap-1 rounded-xl border border-hierro bg-noche/40 p-1"
        >
          {[
            { valor: true, etiqueta: "Cerrado" },
            { valor: false, etiqueta: "Horario distinto" },
          ].map((o) => (
            <button
              key={o.etiqueta}
              type="button"
              aria-pressed={cerrado === o.valor}
              onClick={() => elegirModo(o.valor)}
              className={cn(
                "h-11 rounded-lg text-[0.9375rem] font-medium transition-colors",
                cerrado === o.valor
                  ? "bg-ebano-alto text-oro-claro"
                  : "text-arena hover:text-marfil",
              )}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>

        {cerrado ? (
          <p className="flex items-center gap-2 text-sm text-arena">
            <CalendarOff className="size-4 shrink-0 text-oro" aria-hidden />
            Ese día no se van a ofrecer turnos.
          </p>
        ) : (
          <>
            <EditorFranjas franjas={franjas} onChange={setFranjas} etiqueta="día especial" />
            {problema ? <p className="text-sm text-error">{problema}</p> : null}
          </>
        )}

        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="dia-especial-motivo">Motivo (opcional)</Label>
          <Input
            id="dia-especial-motivo"
            value={motivo}
            maxLength={60}
            placeholder="Feriado, vacaciones…"
            onChange={(e) => setMotivo(e.target.value)}
            className="h-12"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-12"
          disabled={!fecha || Boolean(problema) || pendiente}
        >
          {pendiente ? "Guardando…" : "Guardar día especial"}
        </Button>
      </form>
    </Hoja>
  );
}
