import { describe, expect, it } from "vitest";
import { enviarATodas, type Suscripcion } from "@/lib/push/envio";
import {
  agruparPorDia,
  aInstante,
  cuandoTurno,
  diaDeLaSemana,
  diaLargo,
  etiquetaDia,
  fechaTurno,
  horaTurno,
  momentoDelDia,
  nombreRelativo,
  partesDia,
  proximosDias,
  sumarDias,
} from "./fechas";
import { franjaSiguiente, generarSlots, opcionesHora, problemaFranjas } from "./franjas";
import { archivoIcs } from "./ics";

describe("turnos: archivo .ics", () => {
  it("arma el evento en UTC con recordatorio 2 horas antes", () => {
    const ics = archivoIcs({
      id: "abc",
      inicio: new Date("2026-10-24T21:30:00Z"),
      fin: new Date("2026-10-24T22:00:00Z"),
      titulo: "Turno en FaeBarberShop",
      lugar: "Calle 45 entre 28 y 29, La Plata",
      descripcion: "Con Nahuel.",
      ahora: new Date("2026-10-23T12:00:00Z"),
    });
    expect(ics).toContain("DTSTART:20261024T213000Z\r\n");
    expect(ics).toContain("DTEND:20261024T220000Z\r\n");
    expect(ics).toContain("LOCATION:Calle 45 entre 28 y 29\\, La Plata\r\n");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });

  it("un salto de línea en un dato no puede agregar campos al evento (\\r, \\n, \\r\\n)", () => {
    const ics = archivoIcs({
      id: "abc",
      inicio: new Date("2026-10-24T21:30:00Z"),
      fin: new Date("2026-10-24T22:00:00Z"),
      titulo: "Turno",
      lugar: "x",
      descripcion: "Con Nahuel\rATTENDEE:mailto:a@b.c\nURL:https://evil.example\r\nfin",
      ahora: new Date("2026-10-23T12:00:00Z"),
    });
    const lineas = ics.split("\r\n");
    expect(lineas.filter((l) => /^(ATTENDEE|URL):/.test(l))).toEqual([]);
    expect(ics).toContain(
      "DESCRIPTION:Con Nahuel\\nATTENDEE:mailto:a@b.c\\nURL:https://evil.example\\nfin\r\n",
    );
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
});

describe("turnos: fechas", () => {
  it("entiende el formato de PostgREST y el de Postgres en texto", () => {
    const esperado = "2026-10-24T21:30:00.000Z";
    expect(aInstante("2026-10-24T21:30:00+00:00").toISOString()).toBe(esperado);
    expect(aInstante("2026-10-24 21:30:00+00").toISOString()).toBe(esperado);
    expect(aInstante("2026-10-24T18:30:00-03:00").toISOString()).toBe(esperado);
  });

  it("muestra la hora y la fecha en hora argentina", () => {
    expect(horaTurno("2026-10-24T21:30:00Z")).toBe("18:30");
    // 23:30 de Argentina ya es el día siguiente en UTC.
    expect(fechaTurno("2026-10-25T02:30:00Z")).toBe("2026-10-24");
    expect(horaTurno("2026-10-25T02:30:00Z")).toBe("23:30");
  });

  it("suma días sin correrse (fin de mes y de año)", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(proximosDias("2026-10-30", 3)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("día de la semana como en Postgres (0 = domingo)", () => {
    expect(diaDeLaSemana("2026-10-25")).toBe(0);
    expect(diaDeLaSemana("2026-10-24")).toBe(6);
  });

  it("etiquetas para la tira de días y los mensajes", () => {
    const hoy = "2026-10-23";
    expect(etiquetaDia(hoy, hoy)).toBe("Hoy");
    expect(etiquetaDia("2026-10-24", hoy)).toBe("Mañana");
    expect(etiquetaDia("2026-10-29", hoy)).toBe("Jue 29 de oct");
    expect(nombreRelativo("2026-10-29", hoy)).toBe("el jueves");
    expect(nombreRelativo("2026-10-24", hoy)).toBe("mañana");
    expect(partesDia("2026-10-29")).toMatchObject({ semana: "JUE", numero: "29", mes: "oct" });
    expect(diaLargo("2026-10-24")).toBe("Sábado 24 de octubre");
    expect(cuandoTurno("2026-10-24T13:00:00Z", hoy)).toBe("Mañana 10:00");
    expect(cuandoTurno("2026-10-29T21:30:00Z", hoy)).toBe("Jue 29 de oct, 18:30");
  });

  it("agrupa por mañana, tarde y noche", () => {
    expect(momentoDelDia("10:30")).toBe("Mañana");
    expect(momentoDelDia("13:00")).toBe("Tarde");
    expect(momentoDelDia("19:00")).toBe("Noche");
  });

  it("agrupa los horarios por día argentino", () => {
    const grupos = agruparPorDia(
      [
        { inicio: "2026-10-24T13:00:00Z", fin: "2026-10-24T13:30:00Z" },
        { inicio: "2026-10-25T02:00:00Z", fin: "2026-10-25T03:00:00Z" }, // 23:00 del 24
        { inicio: "2026-10-25T13:00:00Z", fin: "2026-10-25T13:30:00Z" },
        { inicio: "2026-11-30T13:00:00Z", fin: "2026-11-30T13:30:00Z" }, // fuera de los días pedidos
      ],
      ["2026-10-24", "2026-10-25", "2026-10-26"],
    );
    expect(grupos.get("2026-10-24")).toHaveLength(2);
    expect(grupos.get("2026-10-25")).toHaveLength(1);
    expect(grupos.get("2026-10-26")).toEqual([]);
  });
});

describe("turnos: franjas y horarios", () => {
  it("genera los turnos de una franja con su duración", () => {
    expect(generarSlots({ desde: "10:00", hasta: "12:00", duracion_min: 30 })).toEqual([
      "10:00",
      "10:30",
      "11:00",
      "11:30",
    ]);
    expect(generarSlots({ desde: "17:00", hasta: "21:00", duracion_min: 60 })).toEqual([
      "17:00",
      "18:00",
      "19:00",
      "20:00",
    ]);
    // Solo los que entran enteros.
    expect(generarSlots({ desde: "10:00", hasta: "11:30", duracion_min: 60 })).toEqual(["10:00"]);
    expect(generarSlots({ desde: "23:00", hasta: "24:00", duracion_min: 30 })).toEqual([
      "23:00",
      "23:30",
    ]);
  });

  it("valida las franjas de un día", () => {
    expect(
      problemaFranjas([
        { desde: "10:00", hasta: "13:00", duracion_min: 30 },
        { desde: "17:00", hasta: "21:00", duracion_min: 60 },
      ]),
    ).toBeNull();
    expect(
      problemaFranjas([
        { desde: "10:00", hasta: "13:00", duracion_min: 30 },
        { desde: "12:00", hasta: "14:00", duracion_min: 30 },
      ]),
    ).toMatch(/se superponen/);
    expect(problemaFranjas([{ desde: "13:00", hasta: "10:00", duracion_min: 30 }])).toMatch(
      /termina antes/,
    );
    expect(problemaFranjas([{ desde: "10:00", hasta: "10:30", duracion_min: 60 }])).toMatch(
      /no entra/,
    );
    expect(problemaFranjas([{ desde: "10:15", hasta: "11:00", duracion_min: 30 }])).toMatch(
      /en punto/,
    );
  });

  it("opciones de hora cada 30 minutos y franja sugerida", () => {
    const opciones = opcionesHora();
    expect(opciones[0]).toBe("06:00");
    expect(opciones.at(-1)).toBe("24:00");
    expect(opciones).toContain("18:30");
    expect(franjaSiguiente([])).toEqual({ desde: "10:00", hasta: "13:00", duracion_min: 30 });
    expect(franjaSiguiente([{ desde: "10:00", hasta: "13:00", duracion_min: 60 }])).toEqual({
      desde: "17:00",
      hasta: "21:00",
      duracion_min: 60,
    });
  });
});

describe("push: envío", () => {
  const sus = (id: string): Suscripcion => ({
    id,
    endpoint: `https://push.example/${id}`,
    p256dh: "x",
    auth: "y",
  });

  it("separa las suscripciones vencidas (404/410) para borrarlas", async () => {
    const r = await enviarATodas(
      [sus("ok"), sus("vencida"), sus("borrada"), sus("caida")],
      { titulo: "Nuevo turno", cuerpo: "Mañana 10:00", url: "/panel/agenda" },
      async (s) => {
        if (s.id === "vencida") throw Object.assign(new Error("Gone"), { statusCode: 410 });
        if (s.id === "borrada") throw Object.assign(new Error("Not found"), { statusCode: 404 });
        if (s.id === "caida") throw Object.assign(new Error("Timeout"), { statusCode: 503 });
        return {};
      },
    );
    expect(r).toEqual({ enviadas: 1, vencidas: ["vencida", "borrada"], errores: ["Timeout"] });
  });

  it("manda el aviso como JSON", async () => {
    let recibido = "";
    await enviarATodas(
      [sus("a")],
      { titulo: "Turno cancelado", cuerpo: "Hoy 18:30", url: "/panel/agenda", tag: "t1" },
      async (_s, cuerpo) => {
        recibido = cuerpo;
      },
    );
    expect(JSON.parse(recibido)).toEqual({
      titulo: "Turno cancelado",
      cuerpo: "Hoy 18:30",
      url: "/panel/agenda",
      tag: "t1",
    });
  });
});
