import { describe, expect, it } from "vitest";
import { generarPassword, PASSWORD_MIN } from "./password";

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
