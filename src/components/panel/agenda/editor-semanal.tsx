"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { guardarHorarioSemanal } from "@/app/panel/agenda/acciones";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAccionUnica } from "@/hooks/use-accion-unica";
import {
  type Franja,
  type FranjaSemanal,
  franjaSiguiente,
  generarSlots,
  problemaFranjas,
} from "@/lib/turnos/franjas";
import { DIAS_SEMANA } from "@/lib/turnos/reglas";
import { cn } from "@/lib/utils";
import { EditorFranjas } from "./editor-franjas";
import { Hoja } from "./hoja";

type PorDia = Record<number, Franja[]>;

function agrupar(franjas: FranjaSemanal[]): PorDia {
  const r: PorDia = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const { dia_semana, ...f } of franjas) r[dia_semana]!.push(f);
  return r;
}

const aplanar = (porDia: PorDia): FranjaSemanal[] =>
  Object.entries(porDia).flatMap(([dia, fs]) => fs.map((f) => ({ ...f, dia_semana: Number(dia) })));

/** Horario de todas las semanas: por día, franjas con su duración, y copiar a otros días. */
export function EditorSemanal({
  barberoId,
  inicial,
}: {
  barberoId: string;
  inicial: FranjaSemanal[];
}) {
  const router = useRouter();
  const [porDia, setPorDia] = useState<PorDia>(() => agrupar(inicial));
  const [guardado, setGuardado] = useState(() => JSON.stringify(agrupar(inicial)));
  const [copiando, setCopiando] = useState<number | null>(null);
  const { pendiente, ejecutar } = useAccionUnica();

  const cambiado = JSON.stringify(porDia) !== guardado;
  const problemas = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(porDia).map(([dia, fs]) => [dia, problemaFranjas(fs)]),
      ) as Record<number, string | null>,
    [porDia],
  );
  const hayProblemas = Object.values(problemas).some(Boolean);

  const cambiarDia = (dia: number, franjas: Franja[]) =>
    setPorDia((actual) => ({ ...actual, [dia]: franjas }));

  const guardar = () =>
    ejecutar(async () => {
      const r = await guardarHorarioSemanal(barberoId, aplanar(porDia));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setGuardado(JSON.stringify(porDia));
      toast.success("Horarios guardados. Los turnos ya tomados no cambian.");
      router.refresh();
    });

  return (
    <div className="grid grid-cols-1 gap-3">
      {DIAS_SEMANA.map(({ dia, nombre }) => {
        const franjas = porDia[dia] ?? [];
        const atiende = franjas.length > 0;
        const turnos = franjas.reduce((n, f) => n + generarSlots(f).length, 0);
        const problema = problemas[dia];
        return (
          <section
            key={dia}
            aria-label={nombre}
            className={cn(
              "rounded-xl border bg-ebano p-3.5",
              problema ? "border-error/60" : "border-hierro",
            )}
          >
            <div className="flex min-h-11 items-center justify-between gap-3">
              <div>
                <h3 className="font-sans text-base font-medium text-marfil">{nombre}</h3>
                <p className="numeros text-[0.8125rem] text-arena">
                  {atiende ? (turnos === 1 ? "1 turno" : `${turnos} turnos`) : "No atiende"}
                </p>
              </div>
              <Switch
                checked={atiende}
                aria-label={`Atiende los ${nombre.toLowerCase()}`}
                onCheckedChange={(v) => cambiarDia(dia, v ? [franjaSiguiente([])] : [])}
              />
            </div>
            {atiende ? (
              <div className="mt-3 grid grid-cols-1 gap-2">
                <EditorFranjas
                  franjas={franjas}
                  onChange={(fs) => cambiarDia(dia, fs)}
                  etiqueta={nombre.toLowerCase()}
                />
                {problema ? <p className="text-sm text-error">{problema}</p> : null}
                <Button
                  variant="ghost"
                  className="h-11 w-fit px-2 text-arena"
                  onClick={() => setCopiando(dia)}
                >
                  <Copy aria-hidden />
                  Copiar a otros días
                </Button>
              </div>
            ) : null}
          </section>
        );
      })}

      {copiando !== null ? (
        <CopiarDia
          origen={copiando}
          onCerrar={() => setCopiando(null)}
          onCopiar={(destinos) => {
            setPorDia((actual) => {
              const nuevo = { ...actual };
              for (const d of destinos) nuevo[d] = actual[copiando]!.map((f) => ({ ...f }));
              return nuevo;
            });
            setCopiando(null);
          }}
        />
      ) : null}

      {/* Con cambios sin guardar, el botón queda a mano sobre la barra inferior. */}
      {cambiado ? (
        <div className="sticky bottom-[calc(var(--alto-nav-inferior)+env(safe-area-inset-bottom)+0.75rem)] z-20 mt-2 rounded-xl bg-noche lg:bottom-4">
          <Button
            size="xl"
            className="w-full"
            disabled={hayProblemas || pendiente}
            onClick={guardar}
          >
            {pendiente ? "Guardando…" : hayProblemas ? "Revisá las franjas" : "Guardar horarios"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CopiarDia({
  origen,
  onCerrar,
  onCopiar,
}: {
  origen: number;
  onCerrar: () => void;
  onCopiar: (destinos: number[]) => void;
}) {
  const [elegidos, setElegidos] = useState<number[]>([]);
  const nombreOrigen = DIAS_SEMANA.find((d) => d.dia === origen)?.nombre ?? "";
  return (
    <Hoja
      abierta
      onAbiertaChange={(a) => !a && onCerrar()}
      titulo={`Copiar el ${nombreOrigen.toLowerCase()}`}
      descripcion="Elegí a qué días copiar estas franjas. Reemplaza lo que tengan."
    >
      <div className="grid grid-cols-4 gap-2">
        {DIAS_SEMANA.filter((d) => d.dia !== origen).map((d) => {
          const activo = elegidos.includes(d.dia);
          return (
            <button
              key={d.dia}
              type="button"
              aria-pressed={activo}
              onClick={() =>
                setElegidos((e) => (activo ? e.filter((x) => x !== d.dia) : [...e, d.dia]))
              }
              className={cn(
                "h-12 rounded-lg border text-[0.9375rem] font-medium transition-colors",
                activo
                  ? "border-oro-claro bg-ebano-alto text-oro-claro"
                  : "border-hierro text-marfil hover:border-oro/60",
              )}
            >
              {d.corto}
            </button>
          );
        })}
      </div>
      <Button
        size="lg"
        className="h-12"
        disabled={elegidos.length === 0}
        onClick={() => onCopiar(elegidos)}
      >
        Copiar
      </Button>
    </Hoja>
  );
}
