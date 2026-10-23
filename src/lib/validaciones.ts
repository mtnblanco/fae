import { z } from "zod";
import { MONTO_MAX, parsearMonto } from "./dinero";
import { PASSWORD_MAX, PASSWORD_MIN } from "./password";
import { esTelefonoValido, normalizarTelefono } from "./telefono";

const MSJ_TELEFONO = "Ingresá un teléfono válido, con código de área (ej.: 2346 40-1122).";

export const telefonoSchema = z
  .string({ error: MSJ_TELEFONO })
  .trim()
  .min(1, { error: "Ingresá el teléfono." })
  .transform(normalizarTelefono)
  .refine(esTelefonoValido, { error: MSJ_TELEFONO });

export const passwordSchema = z
  .string({ error: "Ingresá una contraseña." })
  .min(PASSWORD_MIN, {
    error: `La contraseña tiene que tener al menos ${PASSWORD_MIN} caracteres.`,
  })
  .max(PASSWORD_MAX, { error: `La contraseña puede tener hasta ${PASSWORD_MAX} caracteres.` });

export const nombreSchema = z
  .string({ error: "Ingresá el nombre." })
  .trim()
  .min(2, { error: "El nombre tiene que tener al menos 2 letras." })
  .max(80, { error: "El nombre puede tener hasta 80 caracteres." })
  .transform((s) => s.replace(/\s+/g, " "));

export const idSchema = z.uuid({ error: "Identificador inválido." });

// ─── Auth ───────────────────────────────────────────────────────────────────
export const loginSchema = z.discriminatedUnion("modo", [
  z.object({
    modo: z.literal("telefono"),
    usuario: telefonoSchema,
    password: z.string().min(1, { error: "Ingresá tu contraseña." }),
  }),
  z.object({
    modo: z.literal("email"),
    usuario: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email({ error: "Ingresá un email válido." })),
    password: z.string().min(1, { error: "Ingresá tu contraseña." }),
  }),
]);

export const cambiarPasswordSchema = z
  .object({
    actual: z.string().optional(),
    nueva: passwordSchema,
    confirmacion: z.string(),
  })
  .refine((d) => d.nueva === d.confirmacion, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmacion"],
  })
  .refine((d) => !d.actual || d.actual !== d.nueva, {
    error: "La nueva contraseña tiene que ser distinta a la actual.",
    path: ["nueva"],
  });

// ─── Montos ─────────────────────────────────────────────────────────────────
const MSJ_MONTO = "Ingresá un monto válido, por ejemplo 8.000 o 8.500,50.";

/** Monto ya leído (número) o null = sin monto. Para las acciones de botones. */
export const montoSchema = z
  .number({ error: MSJ_MONTO })
  .min(0, { error: MSJ_MONTO })
  .max(MONTO_MAX, { error: MSJ_MONTO })
  .nullable();

/** Monto escrito en un campo de texto ("8.000", "8500,50"). Vacío = sin monto. */
export const montoTextoSchema = z.string().transform((texto, ctx) => {
  const leido = parsearMonto(texto);
  if (!leido.ok) {
    ctx.addIssue({ code: "custom", message: MSJ_MONTO });
    return z.NEVER;
  }
  return leido.monto;
});

export const precioClienteSchema = z.object({
  id: idSchema,
  precio: montoTextoSchema,
});

// ─── Clientes ───────────────────────────────────────────────────────────────
export const clienteSchema = z.object({
  nombre: nombreSchema,
  telefono: telefonoSchema,
});

export const altaClienteSchema = clienteSchema.extend({
  password: passwordSchema,
  /** Solo lo carga el dueño; si no viene, el cliente queda sin precio. */
  precio: montoTextoSchema.optional(),
});

export const editarClienteSchema = clienteSchema.extend({
  id: idSchema,
});

export const resetPasswordSchema = z.object({
  id: idSchema,
  password: passwordSchema,
});

// ─── Descuentos ─────────────────────────────────────────────────────────────
const fechaSchema = z.iso.date({ error: "Ingresá una fecha válida." });

export const descuentoSchema = z
  .object({
    id: idSchema.optional(),
    comercio: z
      .string()
      .trim()
      .min(2, { error: "Ingresá el nombre del comercio." })
      .max(80, { error: "El nombre puede tener hasta 80 caracteres." }),
    descripcion: z
      .string()
      .trim()
      .min(3, { error: "Describí el beneficio." })
      .max(280, { error: "La descripción puede tener hasta 280 caracteres." }),
    vigente_desde: fechaSchema,
    vigente_hasta: z
      .union([fechaSchema, z.literal("")])
      .optional()
      .transform((v) => v || null),
    activo: z.boolean(),
  })
  .refine((d) => !d.vigente_hasta || d.vigente_hasta >= d.vigente_desde, {
    error: "La fecha de fin no puede ser anterior a la de inicio.",
    path: ["vigente_hasta"],
  });

// ─── Regla de premios (etapas) ──────────────────────────────────────────────
// Los mismos límites que valida la base (guardar_regla_etapas).
export const CORTES_MIN = 1;
export const CORTES_MAX = 30;
export const ETAPAS_MAX = 6;

const etapaSchema = z.object({
  corte: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ error: "¿En qué corte?" })
      .int({ error: "Tiene que ser un número entero." })
      .min(CORTES_MIN, { error: `Desde el corte ${CORTES_MIN}.` })
      .max(CORTES_MAX, { error: `Hasta el corte ${CORTES_MAX}.` }),
  ),
  descripcion: z
    .string({ error: "Describí el premio." })
    .trim()
    .min(3, { error: "Describí el premio." })
    .max(120, { error: "Hasta 120 caracteres." }),
});

export const etapasSchema = z
  .array(etapaSchema)
  .min(1, { error: "Agregá al menos una etapa." })
  .max(ETAPAS_MAX, { error: `Puede haber hasta ${ETAPAS_MAX} etapas.` })
  .superRefine((etapas, ctx) => {
    const vistos = new Set<number>();
    etapas.forEach((e, i) => {
      if (vistos.has(e.corte)) {
        ctx.addIssue({
          code: "custom",
          message: `Ya hay otra etapa en el corte ${e.corte}.`,
          path: [i, "corte"],
        });
      }
      vistos.add(e.corte);
    });
  })
  .transform((etapas) => [...etapas].sort((a, b) => a.corte - b.corte));

export type ErroresEtapas = {
  general?: string;
  filas: Record<number, { corte?: string; descripcion?: string }>;
};

/** Valida las etapas tal como vienen del formulario (en su orden) y dice qué falla en cada fila. */
export function validarEtapas(
  crudas: unknown,
):
  | { ok: true; etapas: { corte: number; descripcion: string }[] }
  | { ok: false; errores: ErroresEtapas } {
  const r = etapasSchema.safeParse(crudas);
  if (r.success) return { ok: true, etapas: r.data };
  const errores: ErroresEtapas = { filas: {} };
  for (const issue of r.error.issues) {
    const [i, campo] = issue.path;
    if (typeof i === "number" && (campo === "corte" || campo === "descripcion")) {
      const fila = (errores.filas[i] ??= {});
      fila[campo] ??= issue.message;
    } else {
      errores.general ??= issue.message;
    }
  }
  // Zod no corre el chequeo de repetidos si alguna fila tiene otro error: lo hacemos acá.
  if (Array.isArray(crudas)) {
    const vistos = new Set<number>();
    crudas.forEach((e: unknown, i) => {
      const corte = Number((e as { corte?: unknown } | null)?.corte);
      if (!Number.isInteger(corte) || String((e as { corte?: unknown }).corte).trim() === "")
        return;
      if (vistos.has(corte)) {
        const fila = (errores.filas[i] ??= {});
        fila.corte ??= `Ya hay otra etapa en el corte ${corte}.`;
      }
      vistos.add(corte);
    });
  }
  return { ok: false, errores };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
export type ErroresDeCampo = Partial<Record<string, string[]>>;

export function erroresDeCampo(error: z.ZodError): ErroresDeCampo {
  return z.flattenError(error).fieldErrors as ErroresDeCampo;
}
