import { describe, expect, it } from "vitest";
import { aNumero, formatearPesos, MONTO_MAX, montoParaInput, parsearMonto } from "./dinero";

const NBSP = "\u00a0";

describe("formatearPesos", () => {
  it("usa punto de miles y sin decimales si es un monto redondo", () => {
    expect(formatearPesos(8000)).toBe(`$${NBSP}8.000`);
    expect(formatearPesos(1250000)).toBe(`$${NBSP}1.250.000`);
    expect(formatearPesos(0)).toBe(`$${NBSP}0`);
  });

  it("muestra centavos con coma cuando los hay", () => {
    expect(formatearPesos(8500.5)).toBe(`$${NBSP}8.500,50`);
    expect(formatearPesos(99.99)).toBe(`$${NBSP}99,99`);
  });
});

describe("montoParaInput", () => {
  it("precarga el precio como se lee en pantalla", () => {
    expect(montoParaInput(8000)).toBe("8.000");
    expect(montoParaInput(8500.5)).toBe("8.500,50");
    expect(montoParaInput(null)).toBe("");
    expect(montoParaInput(undefined)).toBe("");
  });

  it("lo que precarga se vuelve a leer igual", () => {
    for (const n of [0, 500, 8000, 8500.5, 1250000, MONTO_MAX]) {
      expect(parsearMonto(montoParaInput(n))).toEqual({ ok: true, monto: n });
    }
  });
});

describe("parsearMonto", () => {
  it("vacío es 'sin monto'", () => {
    expect(parsearMonto("")).toEqual({ ok: true, monto: null });
    expect(parsearMonto("   ")).toEqual({ ok: true, monto: null });
  });

  it.each([
    ["8000", 8000],
    ["8.000", 8000],
    ["$ 8.000", 8000],
    ["$8000", 8000],
    ["1.250.000", 1250000],
    ["8.500,50", 8500.5],
    ["8500,5", 8500.5],
    ["8500.5", 8500.5],
    ["8500.50", 8500.5],
    ["0", 0],
    [" 9 000 ", 9000],
  ])("lee %j como %d", (texto, monto) => {
    expect(parsearMonto(texto)).toEqual({ ok: true, monto });
  });

  it.each(["abc", "8,000,00", "8.00.0", "-500", "8.5.5", "1e5", "8000,123", "10.000.000"])(
    "rechaza %j",
    (texto) => {
      expect(parsearMonto(texto)).toEqual({ ok: false });
    },
  );
});

describe("aNumero", () => {
  it("acepta números o texto numérico (numeric de Postgres)", () => {
    expect(aNumero(8000)).toBe(8000);
    expect(aNumero("8500.50")).toBe(8500.5);
    expect(aNumero(null)).toBeNull();
    expect(aNumero(undefined)).toBeNull();
    expect(aNumero("x")).toBeNull();
  });
});
