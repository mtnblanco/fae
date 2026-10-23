import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { requireBarbero } from "@/lib/auth";
import { generarPassword } from "@/lib/password";
import { RUTAS } from "@/lib/rutas";
import { FormularioAlta } from "./formulario-alta";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function PaginaNuevoCliente() {
  const { perfil } = await requireBarbero();
  return (
    <div className="mx-auto max-w-lg">
      <EncabezadoPagina
        titulo="Nuevo cliente"
        descripcion="Cargá sus datos y pasale el teléfono y la contraseña en persona o por WhatsApp."
        volver={
          <Link
            href={RUTAS.clientes}
            className="inline-flex items-center gap-1.5 rounded-md text-sm text-arena transition-colors hover:text-marfil"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Clientes
          </Link>
        }
      />
      <FormularioAlta passwordInicial={generarPassword()} conPrecio={perfil.es_dueno} />
    </div>
  );
}
