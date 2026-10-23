import { describe, expect, it } from "vitest";
import { esRutaSoloDueno, puedeDeshacerCorte } from "./permisos";

describe("esRutaSoloDueno", () => {
  it("la caja, la regla de premios y los descuentos son del dueño", () => {
    expect(esRutaSoloDueno("/panel/caja")).toBe(true);
    expect(esRutaSoloDueno("/panel/caja/algo")).toBe(true);
    expect(esRutaSoloDueno("/panel/reglas")).toBe(true);
    expect(esRutaSoloDueno("/panel/descuentos")).toBe(true);
  });

  it("el resto del panel lo usan los dos", () => {
    expect(esRutaSoloDueno("/panel")).toBe(false);
    expect(esRutaSoloDueno("/panel/clientes")).toBe(false);
    expect(esRutaSoloDueno("/panel/clientes/nuevo")).toBe(false);
    expect(esRutaSoloDueno("/panel/escanear")).toBe(false);
    expect(esRutaSoloDueno("/panel/cajas")).toBe(false);
  });
});

describe("puedeDeshacerCorte", () => {
  const dueno = { id: "d", es_dueno: true };
  const empleado = { id: "e", es_dueno: false };

  it("el dueño puede deshacer cualquier corte", () => {
    expect(puedeDeshacerCorte(dueno, { registrado_por: "e" })).toBe(true);
    expect(puedeDeshacerCorte(dueno, { registrado_por: null })).toBe(true);
  });

  it("el empleado solo los suyos", () => {
    expect(puedeDeshacerCorte(empleado, { registrado_por: "e" })).toBe(true);
    expect(puedeDeshacerCorte(empleado, { registrado_por: "d" })).toBe(false);
    expect(puedeDeshacerCorte(empleado, { registrado_por: null })).toBe(false);
  });
});
