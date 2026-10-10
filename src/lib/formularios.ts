import type { ErroresDeCampo } from "@/lib/validaciones";

/** Estado que devuelven las Server Actions de formularios (para useActionState). */
export type EstadoFormulario<Datos = undefined> = {
  estado: "inicial" | "error" | "ok";
  mensaje?: string;
  errores?: ErroresDeCampo;
  /** Valores a re-mostrar en el formulario si hubo un error. */
  valores?: Record<string, string>;
  datos?: Datos;
};

export const ESTADO_INICIAL = { estado: "inicial" } as const satisfies EstadoFormulario;

export function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}
