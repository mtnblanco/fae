import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mensaje general de un formulario (error o éxito), anunciado a lectores de pantalla. */
export function AvisoFormulario({ tipo, mensaje }: { tipo: "error" | "ok"; mensaje?: string }) {
  if (!mensaje) return null;
  const Icono = tipo === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-snug",
        tipo === "error"
          ? "border-tinta-clara/30 bg-tinta/15 text-tinta-clara"
          : "border-salvia/30 bg-salvia/10 text-salvia",
      )}
    >
      <Icono className="mt-px size-4 shrink-0" aria-hidden />
      <span>{mensaje}</span>
    </div>
  );
}
