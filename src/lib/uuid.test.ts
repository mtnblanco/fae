import { describe, expect, it } from "vitest";
import { nuevoUuid } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("nuevoUuid", () => {
  it("genera UUID v4", () => {
    expect(nuevoUuid()).toMatch(V4);
  });

  it("funciona sin crypto.randomUUID (HTTP sin TLS)", () => {
    const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(crypto), "randomUUID");
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      for (let i = 0; i < 50; i++) expect(nuevoUuid()).toMatch(V4);
    } finally {
      delete (crypto as { randomUUID?: unknown }).randomUUID;
      if (original && typeof crypto.randomUUID !== "function") {
        Object.defineProperty(crypto, "randomUUID", original);
      }
    }
    expect(typeof crypto.randomUUID).toBe("function");
  });
});
