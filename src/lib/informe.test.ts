import { describe, expect, it } from "vitest";
import type { MovimientoCaja } from "@/lib/database.types";
import { armarInforme, informeCsv, leerRangoInforme, nombreArchivoInforme } from "./informe";

const RANGO = { desde: "2026-10-01", hasta: "2026-10-31" };

const mov = (m: Partial<MovimientoCaja>): MovimientoCaja => ({
  tipo: "corte",
  id: "00000000-0000-4000-8000-000000000000",
  fecha: "2026-10-05T21:30:00Z",
  barbero_id: "b1",
  barbero_nombre: "Martín Fae",
  cliente_id: "c1",
  cliente_nombre: "Juan",
  servicio_nombre: null,
  monto: 8000,
  medio_pago: "efectivo",
  registrado_por: "b1",
  ...m,
});

describe("leerRangoInforme", () => {
  it("acepta fechas válidas, ambos días inclusive", () => {
    expect(leerRangoInforme("2026-10-01", "2026-10-31")).toEqual(RANGO);
    expect(leerRangoInforme("2026-10-05", "2026-10-05")).toEqual({
      desde: "2026-10-05",
      hasta: "2026-10-05",
    });
  });

  it("rechaza fechas mal escritas, inexistentes o al revés", () => {
    expect(leerRangoInforme(null, "2026-10-31")).toBeNull();
    expect(leerRangoInforme("2026-10-1", "2026-10-31")).toBeNull();
    expect(leerRangoInforme("2026-02-30", "2026-03-01")).toBeNull();
    expect(leerRangoInforme("2026-10-31", "2026-10-01")).toBeNull();
    expect(leerRangoInforme("2000-01-01", "2026-10-01")).toBeNull();
  });
});

describe("armarInforme", () => {
  const informe = armarInforme(RANGO, [
    mov({ servicio_nombre: "Corte + barba", monto: 12000 }),
    mov({ medio_pago: "transferencia", monto: 9000.5 }),
    mov({ medio_pago: null, monto: 7000 }),
    mov({ monto: null, medio_pago: null }),
    mov({
      tipo: "servicio",
      barbero_nombre: "Lucas Gómez",
      cliente_id: null,
      cliente_nombre: "Pedro",
      servicio_nombre: "Barba",
      monto: 5000,
      medio_pago: "transferencia",
    }),
    mov({ barbero_nombre: null, monto: 1000 }),
  ]);

  it("arma cada fila con día y hora argentinos, servicio y medio de pago", () => {
    expect(informe.filas[0]).toEqual({
      dia: "05/10/2026",
      hora: "18:30",
      barbero: "Martín Fae",
      servicio: "Corte + barba",
      tipo: "Cliente registrado",
      medio: "Efectivo",
      monto: 12000,
    });
    expect(informe.filas.map((f) => [f.servicio, f.medio])).toEqual([
      ["Corte + barba", "Efectivo"],
      ["Corte", "Transferencia"],
      ["Corte", "Sin dato"],
      ["Corte", "Sin cobro"],
      ["Barba", "Transferencia"],
      ["Corte", "Efectivo"],
    ]);
    expect(informe.filas[4]!.tipo).toBe("Sin cliente registrado");
  });

  it("suma por medio de pago (en centavos) y por barbero, el que más cobró primero", () => {
    expect(informe.totales).toEqual({
      cantidad: 6,
      total: 34000.5,
      efectivo: 13000,
      transferencia: 14000.5,
      sinDato: 7000,
    });
    expect(informe.porBarbero.map((b) => [b.barbero, b.cantidad, b.total])).toEqual([
      ["Martín Fae", 4, 28000.5],
      ["Lucas Gómez", 1, 5000],
      ["Sin barbero", 1, 1000],
    ]);
  });

  it("el CSV es para Excel en español: BOM, punto y coma, coma decimal", () => {
    const csv = informeCsv(armarInforme(RANGO, [mov({ servicio_nombre: 'Corte "fade"; navaja' })]));
    expect(csv.startsWith("﻿Fecha;Hora;Barbero;Servicio;Cliente;Medio de pago;Monto\r\n")).toBe(
      true,
    );
    expect(csv).toContain(
      '05/10/2026;18:30;Martín Fae;"Corte ""fade""; navaja";Cliente registrado;Efectivo;8000,00\r\n',
    );
  });

  it("nombre del archivo según el período", () => {
    expect(nombreArchivoInforme(RANGO, "pdf")).toBe("caja-2026-10-01-al-2026-10-31.pdf");
    expect(nombreArchivoInforme({ desde: "2026-10-05", hasta: "2026-10-05" }, "csv")).toBe(
      "caja-2026-10-05.csv",
    );
  });
});
