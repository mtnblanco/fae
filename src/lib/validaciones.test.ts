import { describe, expect, it } from "vitest";
import {
  altaClienteSchema,
  cambiarPasswordSchema,
  descuentoSchema,
  fotoDescuentoSchema,
  loginSchema,
  montoSchema,
  precioClienteSchema,
  validarEtapas,
} from "./validaciones";

describe("loginSchema", () => {
  it("normaliza el teléfono", () => {
    const r = loginSchema.parse({ modo: "telefono", usuario: "+54 9 2346 40-1122", password: "x" });
    expect(r.usuario).toBe("2346401122");
  });

  it("rechaza teléfonos inválidos y emails mal formados", () => {
    expect(loginSchema.safeParse({ modo: "telefono", usuario: "123", password: "x" }).success).toBe(
      false,
    );
    expect(
      loginSchema.safeParse({ modo: "email", usuario: "no-es-email", password: "x" }).success,
    ).toBe(false);
  });

  it("normaliza el email", () => {
    const r = loginSchema.parse({
      modo: "email",
      usuario: "  Barbero@Ejemplo.COM ",
      password: "x",
    });
    expect(r.usuario).toBe("barbero@ejemplo.com");
  });
});

describe("cambiarPasswordSchema", () => {
  it("exige mínimo 8 caracteres y que coincidan", () => {
    const ok = (nueva: string, confirmacion = nueva) =>
      cambiarPasswordSchema.safeParse({ nueva, confirmacion }).success;
    expect(ok("tijera7")).toBe(false);
    expect(ok("tijera77", "tijera78")).toBe(false);
    expect(ok("tijera77")).toBe(true);
  });

  it("rechaza las contraseñas más comunes (sin importar mayúsculas)", () => {
    const ok = (nueva: string) =>
      cambiarPasswordSchema.safeParse({ nueva, confirmacion: nueva }).success;
    for (const p of ["12345678", "Password", "Contraseña", "qwerty123", "aaaaaaaa", "23456789"]) {
      expect(ok(p), p).toBe(false);
    }
    expect(ok("navaja2026")).toBe(true);
  });

  it("la nueva tiene que ser distinta a la actual", () => {
    const r = cambiarPasswordSchema.safeParse({
      actual: "navaja2026",
      nueva: "navaja2026",
      confirmacion: "navaja2026",
    });
    expect(r.success).toBe(false);
  });
});

describe("altaClienteSchema", () => {
  it("limpia el nombre y normaliza el teléfono", () => {
    const r = altaClienteSchema.parse({
      nombre: "  Juan   Pérez ",
      telefono: "02346 401122",
      password: "k7m2p9qa",
    });
    expect(r).toEqual({ nombre: "Juan Pérez", telefono: "2346401122", password: "k7m2p9qa" });
  });

  it("no acepta el teléfono del cliente como contraseña", () => {
    const r = altaClienteSchema.safeParse({
      nombre: "Juan Pérez",
      telefono: "2346401122",
      password: "2346 40-1122",
    });
    expect(r.success).toBe(false);
  });
});

describe("descuentoSchema", () => {
  const base = {
    comercio: "Café",
    descripcion: "10% off",
    vigente_desde: "2026-10-01",
    activo: true,
  };

  it("acepta sin fecha de fin", () => {
    expect(descuentoSchema.parse({ ...base, vigente_hasta: "" }).vigente_hasta).toBeNull();
  });

  it("rechaza fin anterior al inicio", () => {
    expect(descuentoSchema.safeParse({ ...base, vigente_hasta: "2026-09-01" }).success).toBe(false);
  });
});

describe("fotoDescuentoSchema", () => {
  const archivo = (tamano: number, tipo: string) =>
    new File([new Uint8Array(tamano)], "foto", { type: tipo });

  it("acepta WebP y JPEG de hasta 400 KB", () => {
    expect(fotoDescuentoSchema.safeParse(archivo(1000, "image/webp")).success).toBe(true);
    expect(fotoDescuentoSchema.safeParse(archivo(400 * 1024, "image/jpeg")).success).toBe(true);
  });

  it("rechaza otros tipos, archivos vacíos o de más de 400 KB", () => {
    expect(fotoDescuentoSchema.safeParse(archivo(1000, "image/png")).success).toBe(false);
    expect(fotoDescuentoSchema.safeParse(archivo(1000, "image/svg+xml")).success).toBe(false);
    expect(fotoDescuentoSchema.safeParse(archivo(0, "image/jpeg")).success).toBe(false);
    expect(fotoDescuentoSchema.safeParse(archivo(400 * 1024 + 1, "image/jpeg")).success).toBe(
      false,
    );
    expect(fotoDescuentoSchema.safeParse("no es un archivo").success).toBe(false);
  });
});

describe("validarEtapas", () => {
  it("acepta etapas válidas, las ordena y recorta espacios", () => {
    expect(
      validarEtapas([
        { corte: "10", descripcion: " Corte gratis " },
        { corte: "4", descripcion: "20% off" },
      ]),
    ).toEqual({
      ok: true,
      etapas: [
        { corte: 4, descripcion: "20% off" },
        { corte: 10, descripcion: "Corte gratis" },
      ],
    });
  });

  it("marca el error en la fila y el campo que corresponde", () => {
    const r = validarEtapas([
      { corte: "4", descripcion: "20% off" },
      { corte: "", descripcion: "x" },
      { corte: "31", descripcion: "Lejos" },
      { corte: "2.5", descripcion: "Medio" },
      { corte: "4", descripcion: "Repetido" },
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores.filas[0]).toBeUndefined();
    expect(r.errores.filas[1]).toEqual({
      corte: "¿En qué corte?",
      descripcion: "Describí el premio.",
    });
    expect(r.errores.filas[2]?.corte).toBe("Hasta el corte 30.");
    expect(r.errores.filas[3]?.corte).toBe("Tiene que ser un número entero.");
    expect(r.errores.filas[4]?.corte).toBe("Ya hay otra etapa en el corte 4.");
  });

  it("pide entre 1 y 6 etapas", () => {
    expect(validarEtapas([])).toMatchObject({
      ok: false,
      errores: { general: "Agregá al menos una etapa." },
    });
    const siete = Array.from({ length: 7 }, (_, i) => ({ corte: i + 1, descripcion: "Premio" }));
    expect(validarEtapas(siete)).toMatchObject({
      ok: false,
      errores: { general: "Puede haber hasta 6 etapas." },
    });
    expect(validarEtapas("no es una lista").ok).toBe(false);
  });
});

describe("montos y precios", () => {
  const id = "c0000000-0000-4000-8000-000000000001";

  it("montoSchema acepta null (sin monto) y montos dentro del rango", () => {
    expect(montoSchema.parse(null)).toBeNull();
    expect(montoSchema.parse(8000)).toBe(8000);
    expect(montoSchema.safeParse(-1).success).toBe(false);
    expect(montoSchema.safeParse(10_000_000).success).toBe(false);
    expect(montoSchema.safeParse(Number.NaN).success).toBe(false);
  });

  it("precioClienteSchema lee el precio como se escribe en Argentina", () => {
    expect(precioClienteSchema.parse({ id, precio: "8.500" }).precio).toBe(8500);
    expect(precioClienteSchema.parse({ id, precio: "8.500,50" }).precio).toBe(8500.5);
    expect(precioClienteSchema.parse({ id, precio: "" }).precio).toBeNull();
    expect(precioClienteSchema.safeParse({ id, precio: "ocho mil" }).success).toBe(false);
  });

  it("el alta acepta un precio opcional", () => {
    const base = { nombre: "Juan Pérez", telefono: "2346401122", password: "k7m2p9qa" };
    expect(altaClienteSchema.parse(base).precio).toBeUndefined();
    expect(altaClienteSchema.parse({ ...base, precio: "9.000" }).precio).toBe(9000);
    expect(altaClienteSchema.safeParse({ ...base, precio: "x" }).success).toBe(false);
  });
});
