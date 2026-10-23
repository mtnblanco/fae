import { describe, expect, it } from "vitest";
import { esPeriodo, limitesRango, rangoPeriodo } from "./periodos";

describe("rangoPeriodo", () => {
  // Miércoles 22 de octubre de 2026.
  const hoy = "2026-10-22";

  it("hoy", () => {
    expect(rangoPeriodo("hoy", hoy)).toEqual({ desde: hoy, hasta: hoy });
  });

  it("la semana arranca el lunes", () => {
    expect(rangoPeriodo("semana", hoy)).toEqual({ desde: "2026-10-19", hasta: hoy });
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(rangoPeriodo("semana", "2026-10-25")).toEqual({
      desde: "2026-10-19",
      hasta: "2026-10-25",
    });
    // Un lunes es el primer día de su semana.
    expect(rangoPeriodo("semana", "2026-10-19")).toEqual({
      desde: "2026-10-19",
      hasta: "2026-10-19",
    });
  });

  it("este mes, hasta hoy", () => {
    expect(rangoPeriodo("mes", hoy)).toEqual({ desde: "2026-10-01", hasta: hoy });
  });

  it("mes anterior completo, incluso en enero y con febrero bisiesto", () => {
    expect(rangoPeriodo("mes-anterior", hoy)).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-30",
    });
    expect(rangoPeriodo("mes-anterior", "2027-01-05")).toEqual({
      desde: "2026-12-01",
      hasta: "2026-12-31",
    });
    expect(rangoPeriodo("mes-anterior", "2028-03-10")).toEqual({
      desde: "2028-02-01",
      hasta: "2028-02-29",
    });
  });

  it("este año", () => {
    expect(rangoPeriodo("anio", hoy)).toEqual({ desde: "2026-01-01", hasta: hoy });
  });
});

describe("limitesRango", () => {
  it("de las 00:00 del primer día a las 00:00 del día siguiente al último, hora argentina", () => {
    expect(limitesRango({ desde: "2026-10-01", hasta: "2026-10-31" })).toEqual({
      inicio: "2026-10-01T00:00:00-03:00",
      fin: "2026-11-01T00:00:00-03:00",
    });
    expect(limitesRango({ desde: "2026-12-31", hasta: "2026-12-31" }).fin).toBe(
      "2027-01-01T00:00:00-03:00",
    );
  });
});

describe("esPeriodo", () => {
  it("acepta solo los períodos conocidos", () => {
    expect(esPeriodo("mes")).toBe(true);
    expect(esPeriodo("siempre")).toBe(false);
    expect(esPeriodo(undefined)).toBe(false);
  });
});
