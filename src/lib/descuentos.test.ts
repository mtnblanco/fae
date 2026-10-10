import { describe, expect, it } from "vitest";
import { estadoDescuento } from "./descuentos";

const hoy = "2026-10-10";

describe("estadoDescuento", () => {
  it.each([
    [{ activo: true, vigente_desde: "2026-10-01", vigente_hasta: null }, "vigente"],
    [{ activo: true, vigente_desde: "2026-10-10", vigente_hasta: "2026-10-10" }, "vigente"],
    [{ activo: true, vigente_desde: "2026-10-11", vigente_hasta: null }, "programado"],
    [{ activo: true, vigente_desde: "2026-09-01", vigente_hasta: "2026-10-09" }, "vencido"],
    [{ activo: false, vigente_desde: "2026-10-01", vigente_hasta: null }, "pausado"],
  ] as const)("%o → %s", (d, esperado) => {
    expect(estadoDescuento(d, hoy)).toBe(esperado);
  });
});
