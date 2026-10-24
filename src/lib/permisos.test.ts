import { describe, expect, it } from "vitest";
import { esRutaSoloDueno, etiquetaPerfil, puedeDeshacerCorte, venceDeshacer } from "./permisos";

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

describe("venceDeshacer", () => {
  const dueno = { id: "d", es_dueno: true };
  const empleado = { id: "e", es_dueno: false };
  // 15:00 en Argentina (18:00 UTC); el día termina a las 03:00 UTC del 24.
  const corte = { fecha: "2026-10-23T18:00:00.000Z", registrado_por: "e" };

  it("el empleado tiene 10 minutos para los suyos", () => {
    expect(venceDeshacer(empleado, corte)).toBe(Date.parse("2026-10-23T18:10:00.000Z"));
    expect(venceDeshacer(empleado, { ...corte, registrado_por: "d" })).toBeNull();
  });

  it("el dueño, hasta el final del día en Argentina", () => {
    expect(venceDeshacer(dueno, corte)).toBe(Date.parse("2026-10-24T03:00:00.000Z"));
  });

  it("el dueño, al menos 10 minutos aunque el corte sea a las 23:55", () => {
    const tarde = { fecha: "2026-10-24T02:55:00.000Z", registrado_por: "d" };
    expect(venceDeshacer(dueno, tarde)).toBe(Date.parse("2026-10-24T03:05:00.000Z"));
  });
});

describe("etiquetaPerfil", () => {
  it("distingue admin, dueño y empleado", () => {
    expect(etiquetaPerfil({ es_dueno: true, es_admin: true })).toBe("Admin");
    expect(etiquetaPerfil({ es_dueno: true, es_admin: false })).toBe("Dueño");
    expect(etiquetaPerfil({ es_dueno: false, es_admin: false })).toBe("Barbero");
  });
});
