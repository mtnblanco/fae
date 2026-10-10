"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { guardarRegla } from "@/app/panel/reglas/acciones";
import { GrillaSellos } from "@/components/carnet/sellos";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Campo } from "@/components/comunes/campo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ESTADO_INICIAL } from "@/lib/formularios";
import { CORTES_MAX, CORTES_MIN } from "@/lib/validaciones";

export function FormularioRegla({ cortes, premio }: { cortes: number; premio: string }) {
  const [estado, accion] = useActionState(guardarRegla, ESTADO_INICIAL);
  const [n, setN] = useState(cortes);
  const [descripcion, setDescripcion] = useState(premio);
  const cambioN = n !== cortes;

  useEffect(() => {
    if (estado.estado === "ok") toast.success(estado.mensaje);
  }, [estado]);

  const acotar = (v: number) => Math.min(CORTES_MAX, Math.max(CORTES_MIN, v));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <form action={accion} className="grid grid-cols-1 gap-5" noValidate>
        <AvisoFormulario
          tipo="error"
          mensaje={estado.estado === "error" ? estado.mensaje : undefined}
        />

        <Campo
          etiqueta="Cortes necesarios para el premio"
          errores={estado.errores?.cortes_necesarios}
          ayuda={`Entre ${CORTES_MIN} y ${CORTES_MAX}.`}
        >
          {(a11y) => (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setN((v) => acotar(v - 1))}
                disabled={n <= CORTES_MIN}
                aria-label="Un corte menos"
              >
                <Minus aria-hidden />
              </Button>
              <Input
                {...a11y}
                name="cortes_necesarios"
                type="number"
                inputMode="numeric"
                min={CORTES_MIN}
                max={CORTES_MAX}
                value={n}
                onChange={(e) => setN(acotar(Number(e.target.value) || CORTES_MIN))}
                className="numeros w-20 text-center text-lg"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setN((v) => acotar(v + 1))}
                disabled={n >= CORTES_MAX}
                aria-label="Un corte más"
              >
                <Plus aria-hidden />
              </Button>
            </div>
          )}
        </Campo>

        <Campo
          etiqueta="Premio"
          errores={estado.errores?.descripcion_premio}
          ayuda="Así lo van a leer tus clientes."
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="descripcion_premio"
              maxLength={120}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="50% off en el siguiente corte"
              required
            />
          )}
        </Campo>

        {cambioN ? (
          <p
            role="note"
            className="rounded-lg border border-bronce/30 bg-bronce/10 px-4 py-3 text-sm leading-relaxed text-bronce-claro"
          >
            Al cambiar la cantidad de cortes, el progreso de cada cliente se recalcula con todo su
            historial. Algunos pueden ganar un premio en el momento, o tener que esperar un poco
            más.
          </p>
        ) : null}

        <BotonEnviar size="lg" textoCargando="Guardando…" className="sm:justify-self-start">
          Guardar regla
        </BotonEnviar>
      </form>

      <aside
        aria-label="Vista previa"
        className="textura-grano rounded-2xl border border-cuero bg-nogal p-5"
      >
        <p className="text-sm text-arena">Así se ve en el carnet</p>
        <GrillaSellos total={n} llenos={Math.max(0, n - 1)} className="mt-4" />
        <p className="mt-4 text-sm text-arena">
          Cada <span className="text-marfil">{n === 1 ? "corte" : `${n} cortes`}</span>:{" "}
          <span className="text-marfil">{descripcion.trim() || "…"}</span>
        </p>
      </aside>
    </div>
  );
}
