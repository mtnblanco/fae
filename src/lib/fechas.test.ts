import { describe, expect, it } from "vitest";
import { formatearDia, hoyISO, tiempoRelativo } from "./fechas";

describe("fechas", () => {
  it("formatearDia no se corre de día por la zona horaria", () => {
    expect(formatearDia("2026-12-01")).toBe("1 de dic de 2026");
    expect(formatearDia("2026-12-01T00:00:00.000Z")).toBe("1 de dic de 2026");
  });

  it("hoyISO usa la hora argentina", () => {
    // 02:00 UTC del 10/10 = 23:00 del 9/10 en Argentina.
    expect(hoyISO(new Date("2026-10-10T02:00:00Z"))).toBe("2026-10-09");
  });

  it("tiempoRelativo", () => {
    const ahora = new Date("2026-10-10T12:00:00Z");
    expect(tiempoRelativo(new Date("2026-10-10T11:59:40Z"), ahora)).toBe("recién");
    expect(tiempoRelativo(new Date("2026-10-10T11:55:00Z"), ahora)).toBe("hace 5 minutos");
    expect(tiempoRelativo(new Date("2026-10-09T12:00:00Z"), ahora)).toBe("ayer");
  });
});
