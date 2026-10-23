/**
 * Tests de la base para TURNOS (migración 20261023000200_turnos.sql).
 *
 * Igual que db.test.ts: PGlite con stubs de Supabase y cada rol simulado con
 * `set role` + `request.jwt.claims`. La hora se fija reemplazando `_ahora()`:
 * "ahora" es el lunes 2/11/2026 a las 12:00 de Argentina.
 *
 *   npm run test:db
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");

const DUENO = "b0000000-0000-4000-8000-000000000001";
const EMPLEADO = "b0000000-0000-4000-8000-000000000002";
const JUAN = "c0000000-0000-4000-8000-000000000001";
const MARTIN = "c0000000-0000-4000-8000-000000000002";
const LUCAS = "c0000000-0000-4000-8000-000000000003";
const SANTIAGO = "c0000000-0000-4000-8000-000000000004";
const NICOLAS = "c0000000-0000-4000-8000-000000000006";

// "Ahora": lunes 2/11/2026, 12:00 en Argentina (UTC-3).
const AHORA = "2026-11-02 12:00:00-03";
const HOY = "2026-11-02";
const MANANA = "2026-11-03"; // martes
const MIERCOLES = "2026-11-04";
const JUEVES = "2026-11-05";
const VIERNES = "2026-11-06";

/** Instante en hora argentina, como ISO UTC. */
const ar = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-03:00`).toISOString();

type Rol = { rol: "anon" } | { rol: "authenticated"; sub: string };
const ANON: Rol = { rol: "anon" };
const como = (sub: string): Rol => ({ rol: "authenticated", sub });

let db: PGlite;

async function conRol<T>(rol: Rol, fn: () => Promise<T>): Promise<T> {
  const claims = rol.rol === "anon" ? { role: "anon" } : { role: "authenticated", sub: rol.sub };
  await db.exec(
    `reset role; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false); set role ${rol.rol};`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

async function filas<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}

async function fila<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const [primera] = await filas<T>(sql, params);
  if (!primera) throw new Error(`La consulta no devolvió filas: ${sql}`);
  return primera;
}

async function esperarError(promesa: Promise<unknown>, patron: RegExp) {
  await expect(promesa).rejects.toThrow(patron);
}

const SIN_PERMISO = /permission denied/;
const iso = (d: unknown) => new Date(d as string).toISOString();

/** Horarios libres de un barbero en una fecha (ISO UTC), vistos por un cliente. */
async function libres(barbero: string, fecha?: string, cliente = SANTIAGO) {
  const rows = await conRol(como(cliente), () =>
    filas<{ inicio: Date }>(`select inicio from horarios_libres($1)`, [barbero]),
  );
  const todos = rows.map((r) => iso(r.inicio));
  if (!fecha) return todos;
  const desde = new Date(`${fecha}T00:00:00-03:00`).getTime();
  return todos.filter((t) => {
    const ms = new Date(t).getTime();
    return ms >= desde && ms < desde + 86_400_000;
  });
}

function reservar(cliente: string, barbero: string, inicio: string, solicitud?: string) {
  return conRol(como(cliente), () =>
    fila<{ id: string; inicio: Date; fin: Date; estado: string; cliente_id: string }>(
      `select * from reservar_turno($1, $2, $3)`,
      [barbero, inicio, solicitud ?? null],
    ),
  );
}

function cancelar(quien: string, turno: string) {
  return conRol(como(quien), () =>
    fila<{ estado: string }>(`select * from cancelar_turno($1)`, [turno]),
  );
}

const HORARIO_EMPLEADO = [1, 2, 3, 4, 5, 6].flatMap((dia) => [
  { dia_semana: dia, desde: "10:00", hasta: "13:00", duracion_min: 30 },
  { dia_semana: dia, desde: "17:00", hasta: "21:00", duracion_min: 60 },
]);

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
  await db.exec(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
  for (const archivo of readdirSync(join(RAIZ, "migrations")).sort()) {
    await db.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  await db.exec(readFileSync(join(RAIZ, "seed.sql"), "utf8"));
  // Reloj fijo para las funciones de turnos.
  await db.exec(`create or replace function public._ahora() returns timestamptz
    language sql stable set search_path = '' as $$ select '${AHORA}'::timestamptz $$;`);
});

afterAll(async () => {
  await db?.close();
});

// ════════════════════════════════════════════════════════════════════════════
describe("horario semanal", () => {
  it("el empleado carga su horario", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select guardar_horario_semanal($1, $2)`, [
        EMPLEADO,
        JSON.stringify(HORARIO_EMPLEADO),
      ]),
    );
    const r = await conRol(como(EMPLEADO), () =>
      filas(`select * from horarios_semanales where barbero_id = $1`, [EMPLEADO]),
    );
    expect(r).toHaveLength(12);
  });

  it("rechaza franjas superpuestas o que no son en punto o y media", async () => {
    await conRol(como(EMPLEADO), async () => {
      await esperarError(
        db.query(`select guardar_horario_semanal($1, $2)`, [
          EMPLEADO,
          JSON.stringify([
            { dia_semana: 1, desde: "10:00", hasta: "13:00", duracion_min: 30 },
            { dia_semana: 1, desde: "12:00", hasta: "14:00", duracion_min: 60 },
          ]),
        ]),
        /franjas_superpuestas/,
      );
      await esperarError(
        db.query(`select guardar_horario_semanal($1, $2)`, [
          EMPLEADO,
          JSON.stringify([{ dia_semana: 1, desde: "10:15", hasta: "13:00", duracion_min: 30 }]),
        ]),
        /franjas_invalidas/,
      );
      await esperarError(
        db.query(`select guardar_horario_semanal($1, $2)`, [
          EMPLEADO,
          JSON.stringify([{ dia_semana: 9, desde: "10:00", hasta: "13:00", duracion_min: 30 }]),
        ]),
        /franjas_invalidas/,
      );
    });
    // Un error no borra el horario que ya estaba.
    expect(await libres(EMPLEADO, MANANA)).toHaveLength(10);
  });

  it("el empleado no puede tocar el horario del dueño; el dueño sí el del empleado", async () => {
    await conRol(como(EMPLEADO), () =>
      esperarError(db.query(`select guardar_horario_semanal($1, '[]')`, [DUENO]), /no_autorizado/),
    );
    await conRol(como(DUENO), () =>
      db.query(`select guardar_horario_semanal($1, $2)`, [
        EMPLEADO,
        JSON.stringify(HORARIO_EMPLEADO),
      ]),
    );
    expect(await libres(EMPLEADO, MANANA)).toHaveLength(10);
  });

  it("un cliente o un visitante no pueden cargar horarios", async () => {
    await conRol(como(JUAN), () =>
      esperarError(
        db.query(`select guardar_horario_semanal($1, '[]')`, [EMPLEADO]),
        /no_autorizado/,
      ),
    );
    await conRol(ANON, () =>
      esperarError(db.query(`select guardar_horario_semanal($1, '[]')`, [EMPLEADO]), SIN_PERMISO),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("generación de horarios libres", () => {
  it("arma los turnos de cada franja con su duración", async () => {
    expect(await libres(EMPLEADO, MANANA)).toEqual([
      ar(MANANA, "10:00"),
      ar(MANANA, "10:30"),
      ar(MANANA, "11:00"),
      ar(MANANA, "11:30"),
      ar(MANANA, "12:00"),
      ar(MANANA, "12:30"),
      ar(MANANA, "17:00"),
      ar(MANANA, "18:00"),
      ar(MANANA, "19:00"),
      ar(MANANA, "20:00"),
    ]);
  });

  it("los domingos (sin franjas) no hay horarios", async () => {
    expect(await libres(EMPLEADO, "2026-11-08")).toEqual([]);
  });

  it("hoy solo ofrece horarios con al menos 1 hora de anticipación", async () => {
    // Son las 12:00: la mañana ya no se ofrece; la tarde sí.
    expect(await libres(EMPLEADO, HOY)).toEqual([
      ar(HOY, "17:00"),
      ar(HOY, "18:00"),
      ar(HOY, "19:00"),
      ar(HOY, "20:00"),
    ]);
  });

  it("ofrece 14 días (hoy y 13 más) y nada después", async () => {
    const todos = await libres(EMPLEADO);
    const ultimo = todos.at(-1)!;
    // El 15/11 es domingo: el último día con horarios es el sábado 14/11.
    expect(ultimo).toBe(ar("2026-11-14", "20:00"));
    expect(todos.every((t) => t < ar("2026-11-16", "00:00"))).toBe(true);
  });

  it("no devuelve quién reservó ni otra información", async () => {
    const r = await conRol(como(JUAN), () =>
      db.query(`select * from horarios_libres($1) limit 1`, [EMPLEADO]),
    );
    expect(r.fields.map((f) => f.name)).toEqual(["inicio", "fin"]);
  });

  it("un visitante sin login no puede consultar horarios", async () => {
    await conRol(ANON, () =>
      esperarError(db.query(`select * from horarios_libres($1)`, [EMPLEADO]), SIN_PERMISO),
    );
  });

  it("barberos_turnos lista solo a quien tiene horario, con su próximo libre", async () => {
    const r = await conRol(como(JUAN), () =>
      db.query<{ id: string; proximo_libre: Date }>(`select * from barberos_turnos()`),
    );
    expect(r.rows.map((b) => b.id)).toEqual([EMPLEADO]);
    expect(iso(r.rows[0]!.proximo_libre)).toBe(ar(HOY, "17:00"));
    expect(r.fields.map((f) => f.name)).toEqual(["id", "nombre", "es_dueno", "proximo_libre"]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("reservar (cliente)", () => {
  let turnoJuan = "";

  it("reserva un horario libre y deja de ofrecerse", async () => {
    const t = await reservar(
      JUAN,
      EMPLEADO,
      ar(MANANA, "10:00"),
      "a1000000-0000-4000-8000-000000000001",
    );
    turnoJuan = t.id;
    expect(t.estado).toBe("reservado");
    expect(t.cliente_id).toBe(JUAN);
    expect(iso(t.fin)).toBe(ar(MANANA, "10:30"));
    expect(await libres(EMPLEADO, MANANA)).not.toContain(ar(MANANA, "10:00"));
  });

  it("es idempotente: la misma solicitud devuelve el mismo turno", async () => {
    const t = await reservar(
      JUAN,
      EMPLEADO,
      ar(MANANA, "10:00"),
      "a1000000-0000-4000-8000-000000000001",
    );
    expect(t.id).toBe(turnoJuan);
  });

  it("otro cliente no puede tomar el mismo horario: 'horario_ocupado'", async () => {
    await esperarError(reservar(MARTIN, EMPLEADO, ar(MANANA, "10:00")), /horario_ocupado/);
  });

  it("la base impide turnos superpuestos aunque dos reservas lleguen a la vez", async () => {
    // Lo que pasa si dos requests pasan el chequeo al mismo tiempo: el insert
    // del segundo choca contra el exclusion constraint (23P01).
    await esperarError(
      db.query(`insert into turnos (barbero_id, cliente_id, inicio, fin) values ($1, $2, $3, $4)`, [
        EMPLEADO,
        MARTIN,
        ar(MANANA, "09:45"),
        ar(MANANA, "10:15"),
      ]),
      /turnos_sin_superposicion/,
    );
    // Un turno de 60 min a las 11:00 y uno de 30 a las 11:30 también se superponen.
    await db.query(
      `insert into turnos (barbero_id, cliente_id, inicio, fin) values ($1, $2, $3, $4)`,
      [EMPLEADO, LUCAS, ar(MANANA, "11:00"), ar(MANANA, "12:00")],
    );
    await esperarError(reservar(MARTIN, EMPLEADO, ar(MANANA, "11:30")), /horario_ocupado/);
    await db.query(`delete from turnos where cliente_id = $1`, [LUCAS]);
  });

  it("un turno cancelado libera el horario", async () => {
    await db.query(
      `insert into turnos (barbero_id, cliente_id, inicio, fin, estado, cancelado_en)
       values ($1, $2, $3, $4, 'cancelado', now())`,
      [EMPLEADO, LUCAS, ar(MANANA, "12:00"), ar(MANANA, "12:30")],
    );
    expect(await libres(EMPLEADO, MANANA)).toContain(ar(MANANA, "12:00"));
  });

  it("un cliente tiene 1 solo turno futuro activo", async () => {
    await esperarError(reservar(JUAN, EMPLEADO, ar(MANANA, "17:00")), /turno_activo/);
  });

  it("exige 1 hora de anticipación (justo 1 hora, sí)", async () => {
    // Día especial hoy: 12:00 a 15:00 cada 30.
    await conRol(como(EMPLEADO), () =>
      db.query(`select guardar_dia_especial($1, $2, $3)`, [
        EMPLEADO,
        HOY,
        JSON.stringify([{ desde: "12:00", hasta: "15:00", duracion_min: 30 }]),
      ]),
    );
    expect(await libres(EMPLEADO, HOY)).toEqual([
      ar(HOY, "13:00"),
      ar(HOY, "13:30"),
      ar(HOY, "14:00"),
      ar(HOY, "14:30"),
    ]);
    await esperarError(reservar(MARTIN, EMPLEADO, ar(HOY, "12:30")), /turno_muy_pronto/);
    const t = await reservar(MARTIN, EMPLEADO, ar(HOY, "13:00"));
    expect(t.estado).toBe("reservado");
  });

  it("reserva hasta 13 días adelante, no 14", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select guardar_dia_especial($1, $2, $3)`, [
        EMPLEADO,
        "2026-11-16",
        JSON.stringify([{ desde: "10:00", hasta: "11:00", duracion_min: 60 }]),
      ]),
    );
    await esperarError(
      reservar(LUCAS, EMPLEADO, ar("2026-11-16", "10:00")),
      /turno_fuera_de_ventana/,
    );
    const t = await reservar(LUCAS, EMPLEADO, ar("2026-11-14", "10:00"));
    expect(t.estado).toBe("reservado");
    await cancelar(LUCAS, t.id);
  });

  it("rechaza horarios que no están en la agenda y barberos que no existen", async () => {
    await esperarError(reservar(LUCAS, EMPLEADO, ar(MANANA, "10:15")), /horario_invalido/);
    await esperarError(reservar(LUCAS, EMPLEADO, ar(MANANA, "14:00")), /horario_invalido/);
    await esperarError(reservar(LUCAS, JUAN, ar(MANANA, "17:00")), /barbero_inexistente/);
  });

  it("un barbero no puede usar reservar_turno; un visitante tampoco", async () => {
    await esperarError(reservar(EMPLEADO, EMPLEADO, ar(MANANA, "17:00")), /no_autorizado/);
    await conRol(ANON, () =>
      esperarError(
        db.query(`select reservar_turno($1, $2)`, [EMPLEADO, ar(MANANA, "17:00")]),
        SIN_PERMISO,
      ),
    );
  });

  it("mi_proximo_turno muestra el turno del cliente y si todavía puede cancelarlo", async () => {
    const juan = await conRol(como(JUAN), () =>
      fila<{ id: string; barbero_nombre: string; puede_cancelar: boolean }>(
        `select * from mi_proximo_turno()`,
      ),
    );
    expect(juan).toMatchObject({
      id: turnoJuan,
      barbero_nombre: "Nahuel Castro",
      puede_cancelar: true,
    });
    // El de Martín es a las 13:00 de hoy: falta 1 hora.
    const martin = await conRol(como(MARTIN), () =>
      fila<{ puede_cancelar: boolean }>(`select * from mi_proximo_turno()`),
    );
    expect(martin.puede_cancelar).toBe(false);
    const santiago = await conRol(como(SANTIAGO), () => filas(`select * from mi_proximo_turno()`));
    expect(santiago).toEqual([]);
  });

  it("después de cancelar, el cliente puede sacar otro", async () => {
    await cancelar(JUAN, turnoJuan);
    const t = await reservar(JUAN, EMPLEADO, ar(MANANA, "17:00"));
    expect(t.estado).toBe("reservado");
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("cancelar", () => {
  it("el cliente cancela con más de 3 horas y el horario se libera", async () => {
    const t = await reservar(SANTIAGO, EMPLEADO, ar(VIERNES, "10:00"));
    expect((await cancelar(SANTIAGO, t.id)).estado).toBe("cancelado");
    expect(await libres(EMPLEADO, VIERNES)).toContain(ar(VIERNES, "10:00"));
    // Cancelar dos veces no falla.
    expect((await cancelar(SANTIAGO, t.id)).estado).toBe("cancelado");
  });

  it("con menos de 3 horas el cliente no puede: 'cancelacion_tardia'", async () => {
    const turno = await fila<{ id: string }>(
      `select id from turnos where cliente_id = $1 and estado = 'reservado'`,
      [MARTIN],
    );
    await esperarError(cancelar(MARTIN, turno.id), /cancelacion_tardia/);
    // El barbero sí.
    expect((await cancelar(EMPLEADO, turno.id)).estado).toBe("cancelado");
  });

  it("un cliente no puede cancelar ni enterarse de un turno ajeno", async () => {
    const turno = await fila<{ id: string }>(
      `select id from turnos where cliente_id = $1 and estado = 'reservado'`,
      [JUAN],
    );
    await esperarError(cancelar(LUCAS, turno.id), /turno_inexistente/);
  });

  it("el empleado no cancela turnos del dueño; el dueño cancela los del empleado", async () => {
    await db.query(
      `insert into turnos (id, barbero_id, cliente_id, inicio, fin)
       values ('a2000000-0000-4000-8000-000000000001', $1, $2, $3, $4)`,
      [DUENO, LUCAS, ar(VIERNES, "15:00"), ar(VIERNES, "15:30")],
    );
    await esperarError(cancelar(EMPLEADO, "a2000000-0000-4000-8000-000000000001"), /no_autorizado/);
    const t = await reservar(SANTIAGO, EMPLEADO, ar(VIERNES, "11:00"));
    expect((await cancelar(DUENO, t.id)).estado).toBe("cancelado");
    await cancelar(DUENO, "a2000000-0000-4000-8000-000000000001");
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("bloqueos", () => {
  let bloqueo = "";

  it("el barbero bloquea un horario y deja de ofrecerse", async () => {
    const b = await conRol(como(EMPLEADO), () =>
      fila<{ id: string; tipo: string }>(`select * from bloquear_horario($1, $2, $3, $4)`, [
        EMPLEADO,
        ar(MIERCOLES, "11:00"),
        ar(MIERCOLES, "11:30"),
        "Trámite",
      ]),
    );
    bloqueo = b.id;
    expect(b.tipo).toBe("bloqueo");
    expect(await libres(EMPLEADO, MIERCOLES)).not.toContain(ar(MIERCOLES, "11:00"));
    await esperarError(reservar(LUCAS, EMPLEADO, ar(MIERCOLES, "11:00")), /horario_ocupado/);
  });

  it("no se puede bloquear encima de un turno reservado", async () => {
    const t = await reservar(LUCAS, EMPLEADO, ar(MIERCOLES, "12:00"));
    await conRol(como(EMPLEADO), () =>
      esperarError(
        db.query(`select bloquear_horario($1, $2, $3)`, [
          EMPLEADO,
          ar(MIERCOLES, "12:00"),
          ar(MIERCOLES, "13:00"),
        ]),
        /horario_ocupado/,
      ),
    );
    await cancelar(LUCAS, t.id);
  });

  it("el empleado no bloquea la agenda del dueño; un cliente no bloquea nada", async () => {
    await conRol(como(EMPLEADO), () =>
      esperarError(
        db.query(`select bloquear_horario($1, $2, $3)`, [
          DUENO,
          ar(MIERCOLES, "11:00"),
          ar(MIERCOLES, "11:30"),
        ]),
        /no_autorizado/,
      ),
    );
    await conRol(como(JUAN), () =>
      esperarError(
        db.query(`select bloquear_horario($1, $2, $3)`, [
          EMPLEADO,
          ar(MIERCOLES, "10:00"),
          ar(MIERCOLES, "10:30"),
        ]),
        /no_autorizado/,
      ),
    );
  });

  it("quitar el bloqueo libera el horario", async () => {
    await cancelar(EMPLEADO, bloqueo);
    expect(await libres(EMPLEADO, MIERCOLES)).toContain(ar(MIERCOLES, "11:00"));
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("días especiales", () => {
  it("un día cerrado no ofrece horarios", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select guardar_dia_especial($1, $2, '[]', 'Casamiento')`, [EMPLEADO, JUEVES]),
    );
    expect(await libres(EMPLEADO, JUEVES)).toEqual([]);
  });

  it("un horario distinto reemplaza al de la semana", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select guardar_dia_especial($1, $2, $3)`, [
        EMPLEADO,
        JUEVES,
        JSON.stringify([{ desde: "15:00", hasta: "17:00", duracion_min: 60 }]),
      ]),
    );
    expect(await libres(EMPLEADO, JUEVES)).toEqual([ar(JUEVES, "15:00"), ar(JUEVES, "16:00")]);
  });

  it("borrar el día especial vuelve al horario de siempre", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select borrar_dia_especial($1, $2)`, [EMPLEADO, JUEVES]),
    );
    expect(await libres(EMPLEADO, JUEVES)).toHaveLength(10);
  });

  it("valida la fecha y los permisos", async () => {
    await conRol(como(EMPLEADO), async () => {
      await esperarError(
        db.query(`select guardar_dia_especial($1, '2026-11-01', '[]')`, [EMPLEADO]),
        /fecha_invalida/,
      );
      await esperarError(
        db.query(`select guardar_dia_especial($1, $2, '[]')`, [DUENO, JUEVES]),
        /no_autorizado/,
      );
    });
    await conRol(como(DUENO), () =>
      db.query(`select guardar_dia_especial($1, $2, '[]')`, [EMPLEADO, "2026-11-07"]),
    );
    expect(await libres(EMPLEADO, "2026-11-07")).toEqual([]);
  });

  it("las fechas cerca de medianoche caen en el día correcto", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select guardar_dia_especial($1, '2026-11-10', $2)`, [
        EMPLEADO,
        JSON.stringify([{ desde: "23:00", hasta: "24:00", duracion_min: 60 }]),
      ]),
    );
    // 23:00 de Argentina es 02:00 UTC del día siguiente.
    expect(await libres(EMPLEADO, "2026-11-10")).toEqual(["2026-11-11T02:00:00.000Z"]);
    const agenda = await conRol(como(EMPLEADO), () =>
      filas<{ inicio: Date }>(`select inicio from agenda_dia($1, '2026-11-10')`, [EMPLEADO]),
    );
    expect(agenda.map((a) => iso(a.inicio))).toEqual(["2026-11-11T02:00:00.000Z"]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("agenda y permisos de lectura", () => {
  it("el empleado ve su agenda con nombre y teléfono del cliente, bloqueos y libres", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select bloquear_horario($1, $2, $3, 'Almuerzo')`, [
        EMPLEADO,
        ar(MANANA, "12:30"),
        ar(MANANA, "13:00"),
      ]),
    );
    const agenda = await conRol(como(EMPLEADO), () =>
      filas<{
        tipo: string;
        inicio: Date;
        cliente_nombre: string | null;
        cliente_telefono: string | null;
        nota: string | null;
      }>(`select * from agenda_dia($1, $2)`, [EMPLEADO, MANANA]),
    );
    const reserva = agenda.find((a) => a.tipo === "reserva");
    expect(reserva?.cliente_nombre).toBeTruthy();
    expect(reserva?.cliente_telefono).toMatch(/^\d+$/);
    expect(agenda.find((a) => a.tipo === "bloqueo")?.nota).toBe("Almuerzo");
    expect(agenda.filter((a) => a.tipo === "libre").length).toBeGreaterThan(0);
    // Ordenada por hora.
    const horas = agenda.map((a) => iso(a.inicio));
    expect([...horas].sort()).toEqual(horas);
  });

  it("el empleado no ve la agenda del dueño; el dueño ve la del empleado", async () => {
    await conRol(como(EMPLEADO), () =>
      esperarError(db.query(`select * from agenda_dia($1, $2)`, [DUENO, MANANA]), /no_autorizado/),
    );
    const r = await conRol(como(DUENO), () =>
      filas(`select * from agenda_dia($1, $2)`, [EMPLEADO, MANANA]),
    );
    expect(r.length).toBeGreaterThan(0);
  });

  it("un cliente no ve agendas ni la tabla de turnos (ni los suyos)", async () => {
    await conRol(como(JUAN), async () => {
      await esperarError(
        db.query(`select * from agenda_dia($1, $2)`, [EMPLEADO, MANANA]),
        /no_autorizado/,
      );
      expect(await filas(`select * from turnos`)).toEqual([]);
      expect(await filas(`select * from horarios_semanales`)).toEqual([]);
      expect(await filas(`select * from dias_especiales`)).toEqual([]);
      await esperarError(
        db.query(
          `insert into turnos (barbero_id, cliente_id, inicio, fin) values ($1, $2, now(), now() + interval '1 hour')`,
          [EMPLEADO, JUAN],
        ),
        SIN_PERMISO,
      );
      await esperarError(db.query(`update turnos set estado = 'cancelado'`), SIN_PERMISO);
    });
    await conRol(ANON, () => esperarError(db.query(`select * from turnos`), SIN_PERMISO));
  });

  it("por RLS, el empleado lee solo su agenda y el dueño todo", async () => {
    const empleado = await conRol(como(EMPLEADO), () =>
      filas<{ barbero_id: string }>(`select barbero_id from turnos`),
    );
    expect(empleado.length).toBeGreaterThan(0);
    expect(empleado.every((t) => t.barbero_id === EMPLEADO)).toBe(true);
    const dueno = await conRol(como(DUENO), () =>
      filas<{ barbero_id: string }>(`select distinct barbero_id from turnos order by 1`),
    );
    expect(dueno.map((t) => t.barbero_id)).toEqual([DUENO, EMPLEADO]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("reservar para un cliente (barbero)", () => {
  it("el barbero reserva en su agenda, aunque el cliente ya tenga turno", async () => {
    const t = await conRol(como(EMPLEADO), () =>
      fila<{ cliente_id: string; creado_por: string }>(
        `select * from reservar_para_cliente($1, $2, $3)`,
        [EMPLEADO, JUAN, ar(MIERCOLES, "17:00")],
      ),
    );
    expect(t).toMatchObject({ cliente_id: JUAN, creado_por: EMPLEADO });
  });

  it("el empleado no reserva en la agenda del dueño y no puede pisar un turno", async () => {
    await conRol(como(EMPLEADO), async () => {
      await esperarError(
        db.query(`select reservar_para_cliente($1, $2, $3)`, [DUENO, JUAN, ar(MIERCOLES, "17:00")]),
        /no_autorizado/,
      );
      await esperarError(
        db.query(`select reservar_para_cliente($1, $2, $3)`, [
          EMPLEADO,
          LUCAS,
          ar(MIERCOLES, "17:00"),
        ]),
        /horario_ocupado/,
      );
      await esperarError(
        db.query(`select reservar_para_cliente($1, $2, $3)`, [
          EMPLEADO,
          EMPLEADO,
          ar(MIERCOLES, "18:00"),
        ]),
        /cliente_inexistente/,
      );
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("suscripciones push", () => {
  const ENDPOINT = "https://fcm.googleapis.com/fcm/send/prueba-empleado";
  const CLAVES = ["BElavePublicaDePrueba1234567890", "authDePrueba"];

  it("el barbero guarda su suscripción y solo la ve él", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select guardar_suscripcion_push($1, $2, $3)`, [ENDPOINT, ...CLAVES]),
    );
    const propias = await conRol(como(EMPLEADO), () => filas(`select * from suscripciones_push`));
    expect(propias).toHaveLength(1);
    const delDueno = await conRol(como(DUENO), () => filas(`select * from suscripciones_push`));
    expect(delDueno).toEqual([]);
  });

  it("un cliente no puede suscribirse ni leer suscripciones", async () => {
    await conRol(como(JUAN), async () => {
      await esperarError(
        db.query(`select guardar_suscripcion_push($1, $2, $3)`, [
          "https://fcm.googleapis.com/fcm/send/cliente",
          ...CLAVES,
        ]),
        /no_autorizado/,
      );
      expect(await filas(`select * from suscripciones_push`)).toEqual([]);
      await esperarError(
        db.query(
          `insert into suscripciones_push (barbero_id, endpoint, p256dh, auth) values ($1, 'https://x.y/z', 'aaaaaaaaaaaa', 'bbbb')`,
          [JUAN],
        ),
        SIN_PERMISO,
      );
    });
    await conRol(ANON, () =>
      esperarError(db.query(`select * from suscripciones_push`), SIN_PERMISO),
    );
  });

  it("valida el endpoint (https) y no borra suscripciones ajenas", async () => {
    await conRol(como(EMPLEADO), () =>
      esperarError(
        db.query(`select guardar_suscripcion_push('http://inseguro/x', $1, $2)`, CLAVES),
        /suscripcion_invalida/,
      ),
    );
    await conRol(como(DUENO), () => db.query(`select borrar_suscripcion_push($1)`, [ENDPOINT]));
    expect(await filas(`select * from suscripciones_push`)).toHaveLength(1);
  });

  it("si otro barbero activa el mismo dispositivo, pasa a ser suyo; y la borra", async () => {
    await conRol(como(DUENO), () =>
      db.query(`select guardar_suscripcion_push($1, $2, $3)`, [ENDPOINT, ...CLAVES]),
    );
    const r = await fila<{ barbero_id: string }>(`select barbero_id from suscripciones_push`);
    expect(r.barbero_id).toBe(DUENO);
    await conRol(como(DUENO), () => db.query(`select borrar_suscripcion_push($1)`, [ENDPOINT]));
    expect(await filas(`select * from suscripciones_push`)).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("corte y turno", () => {
  it("al sumar el corte, el turno de hoy queda atendido; al deshacerlo, vuelve a reservado", async () => {
    // Con la hora real (los cortes usan now()): un turno que empezó hace 20 minutos.
    await db.query(
      `insert into turnos (id, barbero_id, cliente_id, inicio, fin)
       values ('a3000000-0000-4000-8000-000000000001', $1, $2, now() - interval '20 minutes', now() + interval '10 minutes')`,
      [DUENO, NICOLAS],
    );
    const corte = await conRol(como(DUENO), () =>
      fila<{ id: string }>(`select * from registrar_corte($1)`, [NICOLAS]),
    );
    const atendido = await fila<{ estado: string; corte_id: string }>(
      `select estado, corte_id from turnos where id = 'a3000000-0000-4000-8000-000000000001'`,
    );
    expect(atendido).toEqual({ estado: "atendido", corte_id: corte.id });

    await conRol(como(DUENO), () => db.query(`select deshacer_corte($1)`, [corte.id]));
    const reservado = await fila<{ estado: string; corte_id: string | null }>(
      `select estado, corte_id from turnos where id = 'a3000000-0000-4000-8000-000000000001'`,
    );
    expect(reservado).toEqual({ estado: "reservado", corte_id: null });
  });

  it("un turno atendido no se puede cancelar", async () => {
    await db.query(`update cortes set fecha = fecha - interval '2 minutes' where cliente_id = $1`, [
      NICOLAS,
    ]);
    await conRol(como(DUENO), () => db.query(`select registrar_corte($1)`, [NICOLAS]));
    await esperarError(cancelar(DUENO, "a3000000-0000-4000-8000-000000000001"), /turno_atendido/);
  });
});
