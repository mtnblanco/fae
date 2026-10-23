import { describe, expect, it } from "vitest";
import {
  calcularProgreso,
  enFrase,
  etapaAlcanzada,
  etapasDe,
  type PremioEtapa,
  resumenRegla,
  textoCortes,
} from "./progreso";

const base = { cortes_necesarios: 5 };

describe("calcularProgreso (una etapa, como la regla de antes)", () => {
  it("muestra el avance normal", () => {
    expect(calcularProgreso({ ...base, total_cortes: 3, premios_disponibles: 0 })).toMatchObject({
      necesarios: 5,
      mostrados: 3,
      faltan: 2,
      premiosDisponibles: 0,
    });
  });

  it("muestra la tarjeta llena cuando el premio está listo", () => {
    expect(calcularProgreso({ ...base, total_cortes: 5, premios_disponibles: 1 })).toMatchObject({
      mostrados: 5,
      faltan: 0,
      proxima: null,
    });
  });

  it("vuelve a cero después de canjear", () => {
    expect(calcularProgreso({ ...base, total_cortes: 5, premios_disponibles: 0 })).toMatchObject({
      mostrados: 0,
      faltan: 5,
    });
  });

  it("con premio pendiente de antes, sigue sumando la tarjeta nueva", () => {
    expect(calcularProgreso({ ...base, total_cortes: 7, premios_disponibles: 1 })).toMatchObject({
      mostrados: 2,
      faltan: 3,
      premiosDisponibles: 1,
    });
  });

  it("sin regla no muestra sellos", () => {
    expect(
      calcularProgreso({ cortes_necesarios: null, total_cortes: 3, premios_disponibles: 0 })
        .necesarios,
    ).toBe(0);
  });
});

// ─── Varias etapas ──────────────────────────────────────────────────────────
const ETAPAS = [
  { corte: 4, descripcion: "20% off" },
  { corte: 7, descripcion: "50% off" },
  { corte: 10, descripcion: "Corte gratis" },
];

/** Lo mismo que calcula la base (_repartir_premios) para tests sin canjes de otras etapas. */
function premios(total: number, canjeados: Record<number, number> = {}): PremioEtapa[] {
  const ciclos = Math.floor(total / 10);
  const resto = total % 10;
  return ETAPAS.map((e) => {
    const ganados = ciclos + (resto >= e.corte ? 1 : 0);
    const c = canjeados[e.corte] ?? 0;
    return { ...e, ganados, canjeados: c, disponibles: Math.max(0, ganados - c) };
  });
}

function progreso(total: number, canjeados: Record<number, number> = {}) {
  const p = premios(total, canjeados);
  return calcularProgreso({
    total_cortes: total,
    cortes_necesarios: 10,
    etapas: ETAPAS,
    premios: p,
    premios_disponibles: p.reduce((s, x) => s + x.disponibles, 0),
  });
}

describe("calcularProgreso con etapas", () => {
  it("apunta a la próxima etapa", () => {
    expect(progreso(2)).toMatchObject({
      necesarios: 10,
      mostrados: 2,
      faltan: 2,
      proxima: ETAPAS[0],
      disponibles: [],
    });
    expect(progreso(5)).toMatchObject({ mostrados: 5, faltan: 2, proxima: ETAPAS[1] });
    expect(progreso(9)).toMatchObject({ mostrados: 9, faltan: 1, proxima: ETAPAS[2] });
  });

  it("lista los premios ganados sin canjear, en orden de etapa", () => {
    expect(progreso(8).disponibles).toEqual([
      { corte: 4, descripcion: "20% off", cantidad: 1 },
      { corte: 7, descripcion: "50% off", cantidad: 1 },
    ]);
    expect(progreso(8, { 4: 1 }).disponibles).toEqual([
      { corte: 7, descripcion: "50% off", cantidad: 1 },
    ]);
  });

  it("muestra la tarjeta completa hasta canjear el premio de la última etapa", () => {
    expect(progreso(10)).toMatchObject({ mostrados: 10, faltan: 0, proxima: null });
    // Canjear otra etapa no la vacía; canjear la última, sí.
    expect(progreso(10, { 4: 1 })).toMatchObject({ mostrados: 10 });
    expect(progreso(10, { 10: 1 })).toMatchObject({
      mostrados: 0,
      faltan: 4,
      proxima: ETAPAS[0],
    });
  });

  it("en la segunda vuelta los premios ganados siguen disponibles", () => {
    const p = progreso(14, { 10: 1 });
    expect(p).toMatchObject({ mostrados: 4, faltan: 3, proxima: ETAPAS[1], premiosDisponibles: 3 });
    expect(p.disponibles).toEqual([
      { corte: 4, descripcion: "20% off", cantidad: 2 },
      { corte: 7, descripcion: "50% off", cantidad: 1 },
    ]);
  });

  it("ordena las etapas aunque vengan desordenadas", () => {
    expect(
      etapasDe({ etapas: [ETAPAS[2]!, ETAPAS[0]!, ETAPAS[1]!], cortes_necesarios: 10 }),
    ).toEqual(ETAPAS);
  });
});

describe("etapaAlcanzada", () => {
  it("dice qué etapa ganó el último corte, también en las vueltas siguientes", () => {
    expect(etapaAlcanzada(ETAPAS, 3)).toBeNull();
    expect(etapaAlcanzada(ETAPAS, 4)).toEqual(ETAPAS[0]);
    expect(etapaAlcanzada(ETAPAS, 7)).toEqual(ETAPAS[1]);
    expect(etapaAlcanzada(ETAPAS, 10)).toEqual(ETAPAS[2]);
    expect(etapaAlcanzada(ETAPAS, 11)).toBeNull();
    expect(etapaAlcanzada(ETAPAS, 14)).toEqual(ETAPAS[0]);
    expect(etapaAlcanzada(ETAPAS, 20)).toEqual(ETAPAS[2]);
    expect(etapaAlcanzada(ETAPAS, 0)).toBeNull();
    expect(etapaAlcanzada([], 5)).toBeNull();
  });

  it("con una sola etapa, cada N cortes", () => {
    const una = [{ corte: 5, descripcion: "50% off" }];
    expect(etapaAlcanzada(una, 5)).toEqual(una[0]);
    expect(etapaAlcanzada(una, 10)).toEqual(una[0]);
    expect(etapaAlcanzada(una, 6)).toBeNull();
  });
});

describe("textos", () => {
  it("singular y plural", () => {
    expect(textoCortes(1)).toBe("1 corte");
    expect(textoCortes(3)).toBe("3 cortes");
  });

  it("enFrase pasa a minúscula solo la inicial de una palabra común", () => {
    expect(enFrase("Corte gratis")).toBe("corte gratis");
    expect(enFrase("50% OFF")).toBe("50% OFF");
    expect(enFrase("OFF total")).toBe("OFF total");
  });

  it("resumenRegla", () => {
    expect(resumenRegla([{ corte: 5, descripcion: "50% off" }])).toBe("Cada 5 cortes: 50% off");
    expect(resumenRegla(ETAPAS)).toBe(
      "4.º corte: 20% off · 7.º corte: 50% off · 10.º corte: Corte gratis",
    );
  });
});
