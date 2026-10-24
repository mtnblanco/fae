import { describe, expect, it } from "vitest";
import { estadoDescuento, tipoFotoPorBytes, urlFotoDescuento } from "./descuentos";

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

describe("tipoFotoPorBytes", () => {
  const bytes = (...partes: (number[] | string)[]) =>
    Uint8Array.from(
      partes.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)),
    );

  it("reconoce JPEG y WebP por su firma", () => {
    expect(tipoFotoPorBytes(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(tipoFotoPorBytes(bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 "))).toBe("image/webp");
  });

  it("rechaza todo lo demás (PNG, GIF, SVG, RIFF que no es WebP, vacío)", () => {
    expect(tipoFotoPorBytes(bytes([0x89], "PNG", [13, 10, 26, 10]))).toBeNull();
    expect(tipoFotoPorBytes(bytes("GIF89a"))).toBeNull();
    expect(tipoFotoPorBytes(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(tipoFotoPorBytes(bytes("RIFF", [1, 2, 3, 4], "WAVEfmt "))).toBeNull();
    expect(tipoFotoPorBytes(bytes("RIFF"))).toBeNull();
    expect(tipoFotoPorBytes(new Uint8Array())).toBeNull();
  });
});

describe("urlFotoDescuento", () => {
  it("lleva la versión como milisegundos", () => {
    expect(urlFotoDescuento("abc", "2026-10-23T12:00:00.123456+00:00")).toBe(
      `/descuentos/abc/foto?v=${Date.parse("2026-10-23T12:00:00.123Z")}`,
    );
  });
});
