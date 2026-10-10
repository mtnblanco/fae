import { describe, expect, it } from "vitest";
import {
  emailInterno,
  esTelefonoValido,
  formatearTelefono,
  linkWhatsApp,
  normalizarTelefono,
  telefonoWhatsApp,
} from "./telefono";

describe("normalizarTelefono", () => {
  it.each([
    ["2346401122", "2346401122"],
    ["2346 40-1122", "2346401122"],
    ["(2346) 401122", "2346401122"],
    ["02346 401122", "2346401122"],
    ["+54 2346 401122", "2346401122"],
    ["+54 9 2346 40-1122", "2346401122"],
    ["11 2345-6789", "1123456789"],
    ["  ", ""],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });

  it("no toca números de otros países", () => {
    expect(normalizarTelefono("+598 99 123 456")).toBe("59899123456");
  });
});

describe("esTelefonoValido", () => {
  it("acepta entre 8 y 15 dígitos", () => {
    expect(esTelefonoValido("12345678")).toBe(true);
    expect(esTelefonoValido("123456789012345")).toBe(true);
    expect(esTelefonoValido("1234567")).toBe(false);
    expect(esTelefonoValido("1234567890123456")).toBe(false);
    expect(esTelefonoValido("2346a01122")).toBe(false);
  });
});

describe("emailInterno", () => {
  it("arma el email a partir del teléfono", () => {
    expect(emailInterno("2346401122", "clientes.local")).toBe("2346401122@clientes.local");
  });
});

describe("formatearTelefono", () => {
  it("agrupa los números argentinos de 10 dígitos", () => {
    expect(formatearTelefono("2346401122")).toBe("2346 40-1122");
    expect(formatearTelefono("59899123456")).toBe("59899123456");
    expect(formatearTelefono(null)).toBe("");
  });
});

describe("WhatsApp", () => {
  it("convierte a formato internacional argentino", () => {
    expect(telefonoWhatsApp("2346401122")).toBe("5492346401122");
    expect(telefonoWhatsApp("59899123456")).toBeNull();
  });

  it("arma el link con el mensaje codificado", () => {
    expect(linkWhatsApp("2346401122", "Hola & chau")).toBe(
      "https://wa.me/5492346401122?text=Hola%20%26%20chau",
    );
    expect(linkWhatsApp("59899123456", "Hola")).toBe("https://wa.me/?text=Hola");
  });
});
