import { describe, expect, it } from "vitest";
import { distribucion, MAXIMO, nombreArchivoHistoria, recortar, textosHistoria } from "./historia";

const HOY = "2026-10-30";

describe("textosHistoria", () => {
  it("hoy, mañana u otro día; con pocos, 'Últimos turnos'", () => {
    expect(textosHistoria(HOY, HOY, 8, "Martín Fae")).toEqual({
      dia: "Viernes 30 de octubre",
      titulo: { antes: "Turnos", luz: "hoy" },
      dosLineas: false,
      barbero: "Martín",
    });
    expect(textosHistoria("2026-10-31", HOY, 8, "Martín")).toMatchObject({
      titulo: { luz: "mañana" },
      dosLineas: true,
    });
    expect(textosHistoria("2026-11-03", HOY, 8, "Martín").titulo.luz).toBe("disponibles");
    expect(textosHistoria(HOY, HOY, 3, "Martín").titulo).toEqual({
      antes: "Últimos",
      luz: "turnos",
    });
  });
});

describe("distribucion", () => {
  it("3 columnas hasta 12; después 4", () => {
    expect(distribucion(1, 700).tipo).toBe("pocos");
    expect(distribucion(3, 700).tipo).toBe("pocos");
    expect(distribucion(4, 700)).toMatchObject({ tipo: "grilla", columnas: 3, alto: 128 });
    expect(distribucion(12, 700)).toMatchObject({ columnas: 3 });
    expect(distribucion(13, 700)).toMatchObject({ columnas: 4 });
  });

  it("con poco lugar achica las pastillas para que entren todas", () => {
    const d = distribucion(22, 520);
    if (d.tipo !== "grilla") throw new Error("grilla");
    const filas = Math.ceil(22 / d.columnas);
    expect(filas * d.alto + (filas - 1) * d.hueco).toBeLessThanOrEqual(520);
    expect(d.letra).toBeLessThan(42);
  });
});

describe("recortar", () => {
  it("con demasiados, deja lugar para 'y N más'", () => {
    const muchos = Array.from({ length: 40 }, (_, i) => String(i));
    const r = recortar(muchos);
    expect(r.visibles).toHaveLength(MAXIMO - 1);
    expect(r.resto).toBe(40 - (MAXIMO - 1));
    expect(recortar(["10:00"])).toEqual({ visibles: ["10:00"], resto: 0 });
  });
});

describe("nombreArchivoHistoria", () => {
  it("sin tildes ni espacios", () => {
    expect(nombreArchivoHistoria("Martín Fae", HOY)).toBe("turnos-martin-2026-10-30.png");
    expect(nombreArchivoHistoria("Ñandú", HOY)).toBe("turnos-nandu-2026-10-30.png");
  });
});
