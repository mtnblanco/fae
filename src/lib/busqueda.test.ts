import { describe, expect, it } from "vitest";
import { normalizarBusqueda } from "./busqueda";

describe("normalizarBusqueda", () => {
  it("quita tildes, mayúsculas y espacios de más", () => {
    expect(normalizarBusqueda("  Joaquín   TORRES ")).toBe("joaquin torres");
    expect(normalizarBusqueda("Muñoz")).toBe("munoz");
  });

  it("los teléfonos se buscan por dígitos", () => {
    expect(normalizarBusqueda("2346 40-11")).toBe("23464011");
  });

  it("descarta caracteres especiales de PostgREST", () => {
    expect(normalizarBusqueda("juan,(perez).*")).toBe("juan perez");
    expect(normalizarBusqueda("%%")).toBeNull();
    expect(normalizarBusqueda("")).toBeNull();
  });
});
