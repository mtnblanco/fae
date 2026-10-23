import { describe, expect, it } from "vitest";
import { esPasswordComun, esPasswordTelefono, generarPassword, PASSWORD_MIN } from "./password";

describe("generarPassword", () => {
  it("genera contraseñas legibles, con letras y números", () => {
    for (let i = 0; i < 200; i++) {
      const p = generarPassword();
      expect(p).toHaveLength(8);
      expect(p.length).toBeGreaterThanOrEqual(PASSWORD_MIN);
      expect(p).toMatch(/^[a-km-np-z2-9]+$/);
      expect(p).toMatch(/\d/);
      expect(p).toMatch(/[a-z]/);
    }
  });

  it("no repite", () => {
    const set = new Set(Array.from({ length: 500 }, () => generarPassword()));
    expect(set.size).toBe(500);
  });
});

describe("esPasswordComun", () => {
  it("detecta las comunes, las de un solo carácter y las secuencias", () => {
    for (const p of ["12345678", "PASSWORD", "contraseña", "bocajuniors", "zzzzzzzz", "98765432"]) {
      expect(esPasswordComun(p), p).toBe(true);
    }
    for (const p of ["navaja2026", "k7m2p9qa", "13572468"]) {
      expect(esPasswordComun(p), p).toBe(false);
    }
  });

  it("ninguna contraseña generada es común", () => {
    for (let i = 0; i < 200; i++) expect(esPasswordComun(generarPassword())).toBe(false);
  });
});

describe("esPasswordTelefono", () => {
  it("detecta el teléfono escrito de cualquier forma", () => {
    for (const p of ["2346401122", "2346 40-1122", "+54 9 2346 40-1122", "02346401122"]) {
      expect(esPasswordTelefono(p, "2346401122"), p).toBe(true);
    }
  });

  it("no confunde una contraseña que solo lo contiene ni a quien no tiene teléfono", () => {
    expect(esPasswordTelefono("juan2346401122", "2346401122")).toBe(false);
    expect(esPasswordTelefono("2346401123", "2346401122")).toBe(false);
    expect(esPasswordTelefono("2346401122", null)).toBe(false);
  });
});
