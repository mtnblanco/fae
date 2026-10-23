"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mensajeAlta, mensajeReseteo } from "@/lib/mensajes";
import { formatearTelefono, linkWhatsApp } from "@/lib/telefono";

type Props = {
  tipo: "alta" | "reseteo";
  nombre: string;
  telefono: string;
  password: string;
};

async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Respaldo para navegadores sin permiso de portapapeles.
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Datos de acceso para pasarle al cliente en persona o por WhatsApp. */
export function TarjetaCredenciales({ tipo, nombre, telefono, password }: Props) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window === "undefined" ? "" : window.location.origin;
  const mensaje = (tipo === "alta" ? mensajeAlta : mensajeReseteo)({
    nombre,
    telefono,
    password,
    url,
  });

  async function copiar() {
    const ok = await copiarAlPortapapeles(mensaje);
    if (ok) {
      setCopiado(true);
      toast.success("Datos copiados");
      setTimeout(() => setCopiado(false), 2500);
    } else {
      toast.error("No se pudo copiar. Anotá los datos a mano.");
    }
  }

  return (
    <div className="textura-grano overflow-hidden rounded-xl border border-oro/40 bg-ebano">
      <div className="border-b border-hierro px-5 py-4">
        <p className="font-titulo text-xl text-marfil">
          {tipo === "alta" ? "Datos de acceso" : "Contraseña nueva"}
        </p>
        <p className="mt-1 text-sm text-arena">
          Pasáselos a {nombre.split(" ")[0]}. La primera vez que entre va a tener que cambiar la
          contraseña.
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-4 px-5 py-5">
        <div>
          <dt className="text-[0.8125rem] text-arena">Teléfono</dt>
          <dd className="numeros mt-0.5 text-2xl tracking-wide text-marfil">
            {formatearTelefono(telefono)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.8125rem] text-arena">
            Contraseña {tipo === "reseteo" ? "temporal" : "inicial"}
          </dt>
          <dd className="numeros mt-0.5 font-mono text-2xl tracking-[0.12em] text-oro-claro select-all">
            {password}
          </dd>
        </div>
      </dl>
      <div className="grid grid-cols-1 gap-2 border-t border-hierro bg-noche/40 p-4 sm:grid-cols-2">
        <Button type="button" variant="outline" size="lg" onClick={copiar}>
          {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
        <Button
          asChild
          size="lg"
          className="bg-[#25d366] text-[#06301a] hover:bg-[#3ee07c] active:bg-[#1fb257]"
        >
          <a href={linkWhatsApp(telefono, mensaje)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            Enviar por WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
