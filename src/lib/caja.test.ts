import { describe, expect, it } from "vitest";
import { sumarCaja } from "./caja";

const fila = (f: Partial<Parameters<typeof sumarCaja>[0][number]>) => ({
  cortes: 0,
  cortes_sin_monto: 0,
  total: 0,
  servicios: 0,
  efectivo: 0,
  transferencia: 0,
  mensualidades: 0,
  cortes_mensuales: 0,
  ...f,
});

describe("sumarCaja", () => {
  it("suma cortes, servicios y montos de todos los barberos", () => {
    expect(
      sumarCaja([
        fila({
          cortes: 10,
          cortes_sin_monto: 2,
          total: 64000,
          efectivo: 40000,
          transferencia: 24000,
        }),
        fila({ cortes: 5, total: 41000.1, efectivo: 1000.1, transferencia: 30000 }),
        fila({ cortes: 1, cortes_sin_monto: 1 }),
      ]),
    ).toEqual({
      cortes: 16,
      cortesSinMonto: 3,
      servicios: 0,
      mensualidades: 0,
      cortesMensuales: 0,
      total: 105000.1,
      efectivo: 41000.1,
      transferencia: 54000,
      sinMedio: 10000,
      promedio: 8076.93,
    });
  });

  it("los servicios sin cliente suman al total y al promedio", () => {
    const t = sumarCaja([
      fila({ cortes: 1, total: 18000, servicios: 1, efectivo: 10000, transferencia: 8000 }),
    ]);
    expect(t).toMatchObject({ cortes: 1, servicios: 1, total: 18000, sinMedio: 0, promedio: 9000 });
  });

  it("las mensualidades suman al total; sus cortes no", () => {
    const t = sumarCaja([
      fila({ cortes: 1, total: 48000, efectivo: 48000, mensualidades: 1, cortes_mensuales: 3 }),
    ]);
    expect(t).toMatchObject({
      mensualidades: 1,
      cortesMensuales: 3,
      total: 48000,
      promedio: 24000,
    });
  });

  it("no arrastra errores de punto flotante", () => {
    expect(
      sumarCaja([
        fila({ cortes: 1, total: 0.1, efectivo: 0.1 }),
        fila({ cortes: 1, total: 0.2, efectivo: 0.2 }),
      ]),
    ).toMatchObject({ total: 0.3, efectivo: 0.3, sinMedio: 0 });
  });

  it("sin cortes ni servicios con monto no hay promedio", () => {
    expect(sumarCaja([])).toEqual({
      cortes: 0,
      cortesSinMonto: 0,
      servicios: 0,
      mensualidades: 0,
      cortesMensuales: 0,
      total: 0,
      efectivo: 0,
      transferencia: 0,
      sinMedio: 0,
      promedio: null,
    });
    expect(sumarCaja([fila({ cortes: 3, cortes_sin_monto: 3 })]).promedio).toBeNull();
  });
});
