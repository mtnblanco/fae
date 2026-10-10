import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EscanerDinamico } from "@/components/panel/escaner-dinamico";

export const metadata: Metadata = { title: "Escanear carnet" };

export default function PaginaEscanear() {
  return (
    <div className="mx-auto max-w-md">
      <EncabezadoPagina
        titulo="Escanear carnet"
        descripcion="Leé el QR del cliente para sumarle el corte."
      />
      <EscanerDinamico />
    </div>
  );
}
