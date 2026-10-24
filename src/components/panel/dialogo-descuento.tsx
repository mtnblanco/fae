"use client";

import { Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { guardarDescuento } from "@/app/panel/descuentos/acciones";
import { AvisoFormulario } from "@/components/comunes/aviso-formulario";
import { BotonEnviar } from "@/components/comunes/boton-enviar";
import { Campo } from "@/components/comunes/campo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { comprimirFoto, type FotoComprimida } from "@/lib/comprimir-foto";
import type { Descuento } from "@/lib/database.types";
import { urlFotoDescuento } from "@/lib/descuentos";
import { ESTADO_INICIAL } from "@/lib/formularios";

/** Lo que se va a hacer con la foto al guardar. */
type CambioFoto =
  | { accion: "ninguno" }
  | { accion: "quitar" }
  | ({ accion: "poner"; url: string } & FotoComprimida);

/**
 * Foto del local (opcional): desde la cámara o la galería. Se achica y
 * comprime acá mismo; el formulario la manda al guardar.
 */
function CampoFoto({
  descuento,
  cambio,
  setCambio,
  procesando,
  setProcesando,
  errores,
}: {
  descuento?: Descuento;
  cambio: CambioFoto;
  setCambio: (c: CambioFoto) => void;
  procesando: boolean;
  setProcesando: (p: boolean) => void;
  errores?: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

  // Libera la vista previa cuando se cambia o se cierra el diálogo.
  const urlNueva = cambio.accion === "poner" ? cambio.url : null;
  useEffect(() => (urlNueva ? () => URL.revokeObjectURL(urlNueva) : undefined), [urlNueva]);

  const vista =
    cambio.accion === "poner"
      ? cambio.url
      : cambio.accion === "ninguno" && descuento?.foto_actualizada_en
        ? urlFotoDescuento(descuento.id, descuento.foto_actualizada_en)
        : null;

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(undefined);
    setProcesando(true);
    try {
      const foto = await comprimirFoto(archivo);
      setCambio({ accion: "poner", url: URL.createObjectURL(foto.blob), ...foto });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos usar esa foto. Probá con otra.");
    } finally {
      setProcesando(false);
      // Para poder elegir la misma foto otra vez.
      if (input.current) input.current.value = "";
    }
  }

  const elegir = () => input.current?.click();

  return (
    <Campo
      etiqueta="Foto del local (opcional)"
      errores={error ? [error] : errores}
      ayuda="La ven tus clientes en el carnet. Sacala con la cámara o elegila de la galería."
    >
      {(a11y) => (
        <div className="grid grid-cols-1 gap-2.5">
          {/* Sin name: el archivo original no viaja, solo la versión comprimida. */}
          <input
            ref={input}
            id={a11y.id}
            aria-invalid={a11y["aria-invalid"]}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => alElegir(e.target.files?.[0])}
          />
          {vista ? (
            <>
              <div className="relative overflow-hidden rounded-lg border border-hierro bg-ebano-claro">
                {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) o la foto ya guardada. */}
                <img
                  src={vista}
                  alt={`Vista previa de la foto de ${descuento?.comercio ?? "el comercio"}`}
                  className="aspect-[16/9] w-full object-cover"
                />
                {procesando ? <Procesando /> : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  aria-describedby={a11y["aria-describedby"]}
                  onClick={elegir}
                  disabled={procesando}
                >
                  <Camera aria-hidden />
                  Cambiar foto
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-arena hover:text-error"
                  onClick={() => {
                    setError(undefined);
                    setCambio(
                      descuento?.foto_actualizada_en ? { accion: "quitar" } : { accion: "ninguno" },
                    );
                  }}
                  disabled={procesando}
                >
                  <Trash2 aria-hidden />
                  Quitar foto
                </Button>
              </div>
            </>
          ) : (
            <button
              type="button"
              aria-describedby={a11y["aria-describedby"]}
              onClick={elegir}
              disabled={procesando}
              className="relative flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-borde-campo bg-ebano/60 px-4 text-center transition-colors hover:border-oro/60 hover:bg-ebano-claro focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-70"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-ebano-claro text-oro">
                <ImagePlus className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-medium text-marfil">Agregar foto del local</span>
              <span className="text-[0.8125rem] text-arena">
                {cambio.accion === "quitar" ? "Se quita al guardar" : "Cámara o galería"}
              </span>
              {procesando ? <Procesando /> : null}
            </button>
          )}
        </div>
      )}
    </Campo>
  );
}

function Procesando() {
  return (
    <span
      role="status"
      className="absolute inset-0 flex items-center justify-center gap-2 bg-noche/75 text-sm text-marfil"
    >
      <Loader2 className="size-4 animate-spin text-oro" aria-hidden />
      Preparando foto…
    </span>
  );
}

function Formulario({
  descuento,
  hoy,
  alGuardar,
}: {
  descuento?: Descuento;
  hoy: string;
  alGuardar: () => void;
}) {
  const [estado, accion] = useActionState(guardarDescuento, ESTADO_INICIAL);
  const [cambioFoto, setCambioFoto] = useState<CambioFoto>({ accion: "ninguno" });
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const v = estado.valores;

  useEffect(() => {
    if (estado.estado === "ok") {
      if (estado.datos?.avisoFoto) toast.warning(estado.mensaje);
      else toast.success(estado.mensaje);
      alGuardar();
    }
  }, [estado, alGuardar]);

  // La foto va comprimida (no el archivo original) y solo si cambió.
  function enviar(formData: FormData) {
    if (cambioFoto.accion === "poner") {
      const extension = cambioFoto.tipo === "image/webp" ? "webp" : "jpg";
      formData.set("foto", cambioFoto.blob, `foto.${extension}`);
    } else if (cambioFoto.accion === "quitar") {
      formData.set("quitar_foto", "1");
    }
    accion(formData);
  }

  return (
    <form action={enviar} className="grid grid-cols-1 gap-5" noValidate>
      {descuento ? <input type="hidden" name="id" value={descuento.id} /> : null}
      <AvisoFormulario
        tipo="error"
        mensaje={estado.estado === "error" ? estado.mensaje : undefined}
      />
      <Campo etiqueta="Comercio" errores={estado.errores?.comercio}>
        {(a11y) => (
          <Input
            {...a11y}
            name="comercio"
            placeholder="Café del Centro"
            defaultValue={v?.comercio ?? descuento?.comercio}
            required
          />
        )}
      </Campo>
      <Campo
        etiqueta="Beneficio"
        errores={estado.errores?.descripcion}
        ayuda="Qué obtiene el cliente y cómo lo usa."
      >
        {(a11y) => (
          <Textarea
            {...a11y}
            name="descripcion"
            rows={3}
            maxLength={280}
            placeholder="15% off mostrando el carnet."
            defaultValue={v?.descripcion ?? descuento?.descripcion}
            required
          />
        )}
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Desde" errores={estado.errores?.vigente_desde}>
          {(a11y) => (
            <Input
              {...a11y}
              type="date"
              name="vigente_desde"
              defaultValue={v?.vigente_desde ?? descuento?.vigente_desde.slice(0, 10) ?? hoy}
              required
            />
          )}
        </Campo>
        <Campo etiqueta="Hasta (opcional)" errores={estado.errores?.vigente_hasta}>
          {(a11y) => (
            <Input
              {...a11y}
              type="date"
              name="vigente_hasta"
              defaultValue={v?.vigente_hasta ?? descuento?.vigente_hasta?.slice(0, 10) ?? ""}
            />
          )}
        </Campo>
      </div>
      <CampoFoto
        descuento={descuento}
        cambio={cambioFoto}
        setCambio={setCambioFoto}
        procesando={procesandoFoto}
        setProcesando={setProcesandoFoto}
        errores={estado.errores?.foto}
      />
      <div className="flex items-center justify-between gap-4 rounded-lg border border-hierro px-4 py-3">
        <Label htmlFor="descuento-activo" className="grid grid-cols-1 gap-0.5">
          <span className="text-marfil">Activo</span>
          <span className="text-[0.8125rem] font-normal text-arena">
            Si lo pausás, los clientes dejan de verlo.
          </span>
        </Label>
        <Switch id="descuento-activo" name="activo" defaultChecked={descuento?.activo ?? true} />
      </div>
      <BotonEnviar size="lg" textoCargando="Guardando…" disabled={procesandoFoto}>
        {descuento ? "Guardar cambios" : "Crear descuento"}
      </BotonEnviar>
    </form>
  );
}

export function DialogoDescuento({
  descuento,
  hoy,
  disparador,
}: {
  descuento?: Descuento;
  hoy: string;
  disparador: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-titulo text-2xl font-normal">
            {descuento ? "Editar descuento" : "Nuevo descuento"}
          </DialogTitle>
          <DialogDescription>
            Un beneficio en un comercio amigo para los clientes de la barbería.
          </DialogDescription>
        </DialogHeader>
        {abierto ? (
          <Formulario descuento={descuento} hoy={hoy} alGuardar={() => setAbierto(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
