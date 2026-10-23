import { describe, expect, it } from "vitest";
import { nuevoNonce, politicaCsp } from "./csp";

const directivas = (csp: string) =>
  Object.fromEntries(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [nombre, ...valores] = d.split(/\s+/);
        return [nombre!, valores];
      }),
  );

describe("politicaCsp", () => {
  it("producción: nonce, sin unsafe-eval ni unsafe-inline en scripts, Supabase por https y wss", () => {
    const d = directivas(
      politicaCsp({ nonce: "abc", supabaseUrl: "https://x.supabase.co/", desarrollo: false }),
    );
    expect(d["script-src"]).toEqual([
      "'self'",
      "'nonce-abc'",
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
    ]);
    expect(d["connect-src"]).toEqual(["'self'", "https://x.supabase.co", "wss://x.supabase.co"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["worker-src"]).toEqual(["'self'"]);
    expect(d["upgrade-insecure-requests"]).toEqual([]);
  });

  it("desarrollo: unsafe-eval (React) y sin upgrade-insecure-requests", () => {
    const d = directivas(
      politicaCsp({ nonce: "n", supabaseUrl: "http://127.0.0.1:54321", desarrollo: true }),
    );
    expect(d["script-src"]).toContain("'unsafe-eval'");
    expect(d["connect-src"]).toEqual(["'self'", "http://127.0.0.1:54321", "ws://127.0.0.1:54321"]);
    expect(d["upgrade-insecure-requests"]).toBeUndefined();
  });

  it("nonce distinto en cada pedido", () => {
    const a = nuevoNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(nuevoNonce()).not.toBe(a);
  });
});
