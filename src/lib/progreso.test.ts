import { describe, expect, it } from "vitest";
import { calcularProgreso, textoCortes } from "./progreso";

const base = { cortes_necesarios: 5 };

describe("calcularProgreso", () => {
  it("muestra el avance normal", () => {
    expect(
      calcularProgreso({ ...base, total_cortes: 3, sellos_actuales: 3, premios_disponibles: 0 }),
    ).toEqual({
      necesarios: 5,
      mostrados: 3,
      faltan: 2,
      premiosDisponibles: 0,
    });
  });

  it("muestra la tarjeta llena cuando el premio está listo", () => {
    expect(
      calcularProgreso({ ...base, total_cortes: 5, sellos_actuales: 0, premios_disponibles: 1 }),
    ).toMatchObject({
      mostrados: 5,
      faltan: 0,
    });
  });

  it("vuelve a cero después de canjear", () => {
    expect(
      calcularProgreso({ ...base, total_cortes: 5, sellos_actuales: 0, premios_disponibles: 0 }),
    ).toMatchObject({
      mostrados: 0,
      faltan: 5,
    });
  });

  it("con premio pendiente de antes, sigue sumando la tarjeta nueva", () => {
    expect(
      calcularProgreso({ ...base, total_cortes: 7, sellos_actuales: 2, premios_disponibles: 1 }),
    ).toMatchObject({
      mostrados: 2,
      faltan: 3,
      premiosDisponibles: 1,
    });
  });

  it("sin regla no muestra sellos", () => {
    expect(
      calcularProgreso({
        cortes_necesarios: null,
        total_cortes: 3,
        sellos_actuales: 0,
        premios_disponibles: 0,
      }).necesarios,
    ).toBe(0);
  });
});

describe("textoCortes", () => {
  it("singular y plural", () => {
    expect(textoCortes(1)).toBe("1 corte");
    expect(textoCortes(3)).toBe("3 cortes");
  });
});
