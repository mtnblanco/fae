import { describe, expect, it } from "vitest";
import {
  altaClienteSchema,
  cambiarPasswordSchema,
  descuentoSchema,
  loginSchema,
  reglaSchema,
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
  it("exige mínimo 6 caracteres y que coincidan", () => {
    expect(cambiarPasswordSchema.safeParse({ nueva: "12345", confirmacion: "12345" }).success).toBe(
      false,
    );
    expect(
      cambiarPasswordSchema.safeParse({ nueva: "123456", confirmacion: "123457" }).success,
    ).toBe(false);
    expect(
      cambiarPasswordSchema.safeParse({ nueva: "123456", confirmacion: "123456" }).success,
    ).toBe(true);
  });

  it("la nueva tiene que ser distinta a la actual", () => {
    const r = cambiarPasswordSchema.safeParse({
      actual: "abcdef",
      nueva: "abcdef",
      confirmacion: "abcdef",
    });
    expect(r.success).toBe(false);
  });
});

describe("altaClienteSchema", () => {
  it("limpia el nombre y normaliza el teléfono", () => {
    const r = altaClienteSchema.parse({
      nombre: "  Juan   Pérez ",
      telefono: "02346 401122",
      password: "abc123",
    });
    expect(r).toEqual({ nombre: "Juan Pérez", telefono: "2346401122", password: "abc123" });
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

describe("reglaSchema", () => {
  it("valida el rango de cortes", () => {
    expect(
      reglaSchema.safeParse({ cortes_necesarios: "5", descripcion_premio: "Corte gratis" }).success,
    ).toBe(true);
    expect(
      reglaSchema.safeParse({ cortes_necesarios: "0", descripcion_premio: "Corte gratis" }).success,
    ).toBe(false);
    expect(
      reglaSchema.safeParse({ cortes_necesarios: "21", descripcion_premio: "Corte gratis" })
        .success,
    ).toBe(false);
    expect(
      reglaSchema.safeParse({ cortes_necesarios: "2.5", descripcion_premio: "Corte gratis" })
        .success,
    ).toBe(false);
  });
});
