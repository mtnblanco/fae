import { describe, expect, it } from "vitest";
import { idDesdeQr } from "./qr";

const ID = "c0000000-0000-4000-8000-000000000001";

describe("idDesdeQr", () => {
  it("lee la URL del carnet", () => {
    expect(idDesdeQr(`https://lanavaja.vercel.app/panel/clientes/${ID}`)).toBe(ID);
    expect(idDesdeQr(`http://localhost:3000/panel/clientes/${ID.toUpperCase()}/`)).toBe(ID);
  });

  it("acepta el id suelto", () => {
    expect(idDesdeQr(`  ${ID} `)).toBe(ID);
  });

  it("rechaza otros QR", () => {
    expect(idDesdeQr("https://instagram.com/lanavaja")).toBeNull();
    expect(idDesdeQr(`https://otro.com/algo/${ID}`)).toBeNull();
    expect(idDesdeQr("hola")).toBeNull();
    expect(idDesdeQr("")).toBeNull();
  });
});
