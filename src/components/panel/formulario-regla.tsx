"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { type EstadoRegla, guardarRegla } from "@/app/panel/reglas/acciones";
import { ListaEtapas } from "@/components/carnet/lista-etapas";
import { GrillaSellos } from "@/components/carnet/sellos";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Etapa } from "@/lib/progreso";
import { cn } from "@/lib/utils";
import { CORTES_MAX, CORTES_MIN, ETAPAS_MAX, validarEtapas } from "@/lib/validaciones";

type Fila = { clave: number; corte: string; descripcion: string };

const INICIAL: EstadoRegla = { estado: "inicial" };

/** Ordena por número de corte; las filas sin número (o inválido) quedan al final. */
function ordenar(filas: Fila[]): Fila[] {
  const n = (f: Fila) => {
    const v = Number(f.corte);
    return f.corte.trim() === "" || !Number.isFinite(v) ? Infinity : v;
  };
  return [...filas].sort((a, b) => n(a) - n(b));
}

const crudas = (filas: Fila[]) => filas.map(({ corte, descripcion }) => ({ corte, descripcion }));

export function FormularioRegla({ etapas }: { etapas: Etapa[] }) {
  const [estado, accion] = useActionState(guardarRegla, INICIAL);
  const siguienteClave = useRef(etapas.length);
  const [filas, setFilas] = useState<Fila[]>(() =>
    etapas.map((e, i) => ({ clave: i, corte: String(e.corte), descripcion: e.descripcion })),
  );
  // Los errores se muestran después del primer intento de guardar (y se actualizan en vivo).
  const [intento, setIntento] = useState(false);
  const idAyuda = useId();

  useEffect(() => {
    if (estado.estado === "ok") toast.success(estado.mensaje);
  }, [estado]);

  const validacion = validarEtapas(crudas(filas));
  const erroresLocales = intento && !validacion.ok ? validacion.errores : null;
  // Si el servidor rechazó y no se tocó nada desde entonces, se ven sus errores.
  const errores =
    erroresLocales ?? (estado.estado === "error" && !intento ? (estado.errores ?? null) : null);
  const mensajeGeneral =
    errores?.general ??
    (errores
      ? "Revisá las etapas marcadas."
      : estado.estado === "error" && !intento
        ? estado.mensaje
        : undefined);

  // Vista previa: solo con las filas que ya son válidas.
  const previa = ordenar(filas)
    .map((f) => ({ corte: Number(f.corte), descripcion: f.descripcion.trim() }))
    .filter(
      (e, i, todas) =>
        Number.isInteger(e.corte) &&
        e.corte >= CORTES_MIN &&
        e.corte <= CORTES_MAX &&
        todas.findIndex((x) => x.corte === e.corte) === i,
    )
    .map((e) => ({ ...e, descripcion: e.descripcion || "…" }));
  const largo = previa.at(-1)?.corte ?? 0;

  const original = JSON.stringify(etapas);
  const cambio = validacion.ok && JSON.stringify(validacion.etapas) !== original;

  // Si el servidor había marcado errores, al tocar algo pasan a validarse en vivo.
  function editar() {
    if (estado.estado === "error") setIntento(true);
  }

  function cambiar(clave: number, campo: "corte" | "descripcion", valor: string) {
    editar();
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
  }

  function agregar() {
    editar();
    setFilas((fs) => {
      const usados = fs.map((f) => Number(f.corte)).filter(Number.isFinite);
      const mayor = usados.length ? Math.max(...usados) : 0;
      const propuesto = Math.min(CORTES_MAX, mayor + 3);
      const corte = usados.includes(propuesto) ? "" : String(propuesto);
      siguienteClave.current += 1;
      return [...fs, { clave: siguienteClave.current, corte, descripcion: "" }];
    });
  }

  function quitar(clave: number) {
    editar();
    setFilas((fs) => fs.filter((f) => f.clave !== clave));
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <form
        action={accion}
        className="grid grid-cols-1 gap-5"
        noValidate
        onSubmit={(e) => {
          if (!validacion.ok) {
            e.preventDefault();
            setIntento(true);
            return;
          }
          setIntento(false);
        }}
      >
        <AvisoFormulario tipo="error" mensaje={mensajeGeneral} />
        <input type="hidden" name="etapas" value={JSON.stringify(crudas(filas))} />

        <fieldset className="grid grid-cols-1 gap-3" aria-describedby={idAyuda}>
          <legend className="mb-1.5 text-sm font-medium text-marfil">Etapas de la tarjeta</legend>
          <p id={idAyuda} className="text-[0.8125rem] leading-snug text-arena">
            En qué corte se gana cada premio. La última etapa completa la tarjeta, que vuelve a
            empezar. Hasta {ETAPAS_MAX} etapas, del corte {CORTES_MIN} al {CORTES_MAX}.
          </p>

          {/* Se ordenan solas al salir de la lista (no mientras se pasa de un campo a otro:
              mover la fila en medio de un toque le sacaría el foco al teclado). */}
          <ol
            className="grid grid-cols-1 gap-3"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFilas(ordenar);
            }}
          >
            {filas.map((f, i) => (
              <FilaEtapa
                key={f.clave}
                fila={f}
                numero={i + 1}
                ultima={i === filas.length - 1 && filas.length > 1}
                errores={errores?.filas[i]}
                puedeQuitar={filas.length > 1}
                onCambiar={(campo, valor) => cambiar(f.clave, campo, valor)}
                onQuitar={() => quitar(f.clave)}
              />
            ))}
          </ol>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={agregar}
            disabled={filas.length >= ETAPAS_MAX}
            className="sm:justify-self-start"
          >
            <Plus aria-hidden />
            {filas.length >= ETAPAS_MAX ? `Máximo ${ETAPAS_MAX} etapas` : "Agregar etapa"}
          </Button>
        </fieldset>

        {cambio ? (
          <p
            role="note"
            className="rounded-lg border border-oro/30 bg-oro/10 px-4 py-3 text-sm leading-relaxed text-oro-claro"
          >
            Al guardar, los premios de cada cliente se recalculan con todo su historial. Lo ya
            canjeado no se toca y nadie queda en negativo: algunos pueden ganar un premio en el
            momento, o esperar un poco más.
          </p>
        ) : null}

        <BotonEnviar size="lg" textoCargando="Guardando…" className="sm:justify-self-start">
          Guardar regla
        </BotonEnviar>
      </form>

      <aside
        aria-label="Vista previa"
        className="textura-grano rounded-2xl border border-hierro bg-ebano p-5 lg:sticky lg:top-6"
      >
        <p className="text-sm text-arena">Así se ve en el carnet</p>
        {largo > 0 ? (
          <>
            <GrillaSellos
              total={largo}
              premios={previa.map((e) => e.corte)}
              llenos={Math.max(0, Math.min(largo - 1, (previa[0]?.corte ?? 1) + 1))}
              className="mt-4"
            />
            <ListaEtapas etapas={previa} className="mt-5" />
            <p className="mt-3 text-[0.8125rem] text-arena">
              Tarjeta de {largo === 1 ? "1 corte" : `${largo} cortes`}; al completarla, vuelve a
              empezar.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-arena">Cargá al menos una etapa con su corte.</p>
        )}
      </aside>
    </div>
  );
}

function FilaEtapa({
  fila,
  numero,
  ultima,
  errores,
  puedeQuitar,
  onCambiar,
  onQuitar,
}: {
  fila: Fila;
  numero: number;
  ultima: boolean;
  errores?: { corte?: string; descripcion?: string };
  puedeQuitar: boolean;
  onCambiar: (campo: "corte" | "descripcion", valor: string) => void;
  onQuitar: () => void;
}) {
  const id = useId();
  const idsError = [
    errores?.corte ? `${id}-e-corte` : null,
    errores?.descripcion ? `${id}-e-desc` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <li
      className={cn(
        "rounded-xl border bg-ebano p-3.5",
        errores?.corte || errores?.descripcion ? "border-error/50" : "border-hierro",
      )}
    >
      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-end gap-2.5">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-corte`} className="etiqueta text-arena">
            Corte n.º
          </label>
          <Input
            id={`${id}-corte`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="next"
            autoComplete="off"
            maxLength={2}
            value={fila.corte}
            onChange={(e) => onCambiar("corte", e.target.value.replace(/\D/g, ""))}
            aria-invalid={errores?.corte ? true : undefined}
            aria-describedby={idsError || undefined}
            className="numeros text-center text-lg"
          />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={`${id}-desc`} className="etiqueta text-arena">
            Premio{ultima ? " · completa la tarjeta" : ""}
          </label>
          <Input
            id={`${id}-desc`}
            value={fila.descripcion}
            maxLength={120}
            enterKeyHint="done"
            onChange={(e) => onCambiar("descripcion", e.target.value)}
            placeholder={numero === 1 ? "20% off" : "Corte gratis"}
            aria-invalid={errores?.descripcion ? true : undefined}
            aria-describedby={idsError || undefined}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onQuitar}
          disabled={!puedeQuitar}
          aria-label={`Quitar la etapa ${numero}`}
          className="text-arena hover:text-error"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {errores?.corte ? (
        <p id={`${id}-e-corte`} className="mt-2 text-[0.8125rem] font-medium text-error">
          {errores.corte}
        </p>
      ) : null}
      {errores?.descripcion ? (
        <p id={`${id}-e-desc`} className="mt-2 text-[0.8125rem] font-medium text-error">
          {errores.descripcion}
        </p>
      ) : null}
    </li>
  );
}
