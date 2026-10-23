import { describe, expect, it } from "vitest";
import { claveCuenta, ipDelPedido, mensajeDeEspera } from "./intentos";

const cabeceras = (h: Record<string, string>) => new Headers(h);

describe("ipDelPedido", () => {
  it("usa x-real-ip y, si no está, la primera de x-forwarded-for", () => {
    expect(ipDelPedido(cabeceras({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(ipDelPedido(cabeceras({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe(
      "198.51.100.1",
    );
    expect(
      ipDelPedido(cabeceras({ "x-real-ip": "2001:DB8::1", "x-forwarded-for": "198.51.100.1" })),
    ).toBe("2001:db8::1");
  });

  it("sin cabecera o con basura devuelve null", () => {
    expect(ipDelPedido(cabeceras({}))).toBeNull();
    expect(ipDelPedido(cabeceras({ "x-real-ip": "<script>" }))).toBeNull();
    expect(ipDelPedido(cabeceras({ "x-forwarded-for": "x".repeat(300) }))).toBeNull();
  });
});

describe("mensajeDeEspera", () => {
  it("redondea hacia arriba en minutos", () => {
    expect(mensajeDeEspera(1)).toBe("Demasiados intentos. Probá de nuevo en 1 minuto.");
    expect(mensajeDeEspera(61)).toBe("Demasiados intentos. Probá de nuevo en 2 minutos.");
    expect(mensajeDeEspera(900)).toBe("Demasiados intentos. Probá de nuevo en 15 minutos.");
  });
});

describe("claveCuenta", () => {
  it("no distingue mayúsculas", () => {
    expect(claveCuenta(" Barbero@FaeBarberShop.test ")).toBe(
      "login:cuenta:barbero@faebarbershop.test",
    );
  });
});
