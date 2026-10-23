import { describe, expect, it } from "vitest";
import { sumarCaja } from "./caja";

describe("sumarCaja", () => {
  it("suma cortes y montos de todos los barberos", () => {
    expect(
      sumarCaja([
        { cortes: 10, cortes_sin_monto: 2, total: 64000 },
        { cortes: 5, cortes_sin_monto: 0, total: 41000.1 },
        { cortes: 1, cortes_sin_monto: 1, total: 0 },
      ]),
    ).toEqual({ cortes: 16, cortesSinMonto: 3, total: 105000.1, promedio: 8076.93 });
  });

  it("no arrastra errores de punto flotante", () => {
    expect(
      sumarCaja([
        { cortes: 1, cortes_sin_monto: 0, total: 0.1 },
        { cortes: 1, cortes_sin_monto: 0, total: 0.2 },
      ]).total,
    ).toBe(0.3);
  });

  it("sin cortes con monto no hay promedio", () => {
    expect(sumarCaja([])).toEqual({ cortes: 0, cortesSinMonto: 0, total: 0, promedio: null });
    expect(sumarCaja([{ cortes: 3, cortes_sin_monto: 3, total: 0 }]).promedio).toBeNull();
  });
});
