/**
 * Tests de la base para el perfil ADMIN (migración 20261024000100_admin.sql) y
 * los scripts supabase/marcar-admin.sql y supabase/crear-barbero.sql.
 *
 * Igual que db.test.ts y turnos.test.ts: PGlite con stubs de Supabase y cada
 * rol simulado con `set role` + `request.jwt.claims`. "Ahora" es el lunes
 * 2/11/2026 a las 12:00 de Argentina (para las funciones de turnos).
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
const ADMIN = "b0000000-0000-4000-8000-000000000003";
const JUAN = "c0000000-0000-4000-8000-000000000001";
const MARTIN = "c0000000-0000-4000-8000-000000000002";
const NICOLAS = "c0000000-0000-4000-8000-000000000006";

const AHORA = "2026-11-02 12:00:00-03";
const MANANA = "2026-11-03"; // martes
const MIERCOLES = "2026-11-04";

const ar = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-03:00`).toISOString();

type Rol = { rol: "anon" } | { rol: "authenticated"; sub: string };
const ANON: Rol = { rol: "anon" };
const como = (sub: string): Rol => ({ rol: "authenticated", sub });

const SIN_PERMISO = /permission denied/;
const NO_EXISTE = /barbero_inexistente/;

const HORARIO = [1, 2, 3, 4, 5, 6].map((dia) => ({
  dia_semana: dia,
  desde: "10:00",
  hasta: "13:00",
  duracion_min: 30,
}));

const MIGRACION_ADMIN = "20261024000100_admin.sql";

/** Base PGlite con las migraciones (y, si se pide, el seed). */
async function nuevaBase({ hasta, seed }: { hasta?: string; seed: boolean }) {
  const base = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
  await base.exec(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
  for (const archivo of readdirSync(join(RAIZ, "migrations")).sort()) {
    if (hasta && archivo >= hasta) continue;
    await base.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  if (seed) await base.exec(readFileSync(join(RAIZ, "seed.sql"), "utf8"));
  return base;
}

/** Helpers atados a una base. */
function herramientas(base: PGlite) {
  async function conRol<T>(rol: Rol, fn: () => Promise<T>): Promise<T> {
    const claims = rol.rol === "anon" ? { role: "anon" } : { role: "authenticated", sub: rol.sub };
    await base.exec(
      `reset role; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false); set role ${rol.rol};`,
    );
    try {
      return await fn();
    } finally {
      await base.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
    }
  }
  const filas = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await base.query<T>(sql, params)).rows;
  const fila = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => {
    const [primera] = await filas<T>(sql, params);
    if (!primera) throw new Error(`La consulta no devolvió filas: ${sql}`);
    return primera;
  };
  return { conRol, filas, fila };
}

async function esperarError(promesa: Promise<unknown>, patron: RegExp) {
  await expect(promesa).rejects.toThrow(patron);
}

/** Un script de supabase/ con el email de los 👉 reemplazado. */
function script(nombre: string, email: string, nombrePersona?: string) {
  let sql = readFileSync(join(RAIZ, nombre), "utf8").replaceAll("tu-email@ejemplo.com", email);
  if (nombrePersona) sql = sql.replace("'Tu nombre'", `'${nombrePersona}'`);
  return sql;
}

// ════════════════════════════════════════════════════════════════════════════
// Base con el seed (que trae un admin: admin@faebarbershop.test).
// ════════════════════════════════════════════════════════════════════════════
let db: PGlite;
let h: ReturnType<typeof herramientas>;

beforeAll(async () => {
  db = await nuevaBase({ seed: true });
  h = herramientas(db);
  await db.exec(`create or replace function public._ahora() returns timestamptz
    language sql stable set search_path = '' as $$ select '${AHORA}'::timestamptz $$;`);
  // El dueño y el empleado atienden de lunes a sábado a la mañana.
  for (const b of [DUENO, EMPLEADO]) {
    await h.conRol(como(b), () =>
      db.query(`select guardar_horario_semanal($1, $2)`, [b, JSON.stringify(HORARIO)]),
    );
  }
});

afterAll(async () => {
  await db?.close();
});

describe("perfiles.es_admin", () => {
  it("existe, es false por defecto y en el seed solo el admin lo tiene", async () => {
    const r = await h.filas<{ id: string }>(`select id from perfiles where es_admin`);
    expect(r.map((p) => p.id)).toEqual([ADMIN]);
  });

  it("admin implica dueño (y dueño implica barbero)", async () => {
    await esperarError(
      db.query(`update perfiles set es_admin = true where id = $1`, [EMPLEADO]),
      /perfiles_admin_es_dueno/,
    );
    await esperarError(
      db.query(`update perfiles set es_admin = true where id = $1`, [JUAN]),
      /perfiles_admin_es_dueno/,
    );
    await esperarError(
      db.query(`update perfiles set es_dueno = false where id = $1`, [ADMIN]),
      /perfiles_admin_es_dueno/,
    );
    await esperarError(
      db.query(`update perfiles set es_dueno = true, es_admin = true where id = $1`, [JUAN]),
      /perfiles_dueno_es_barbero/,
    );
  });

  it("ni el empleado ni un cliente pueden marcarse admin (ni a nadie)", async () => {
    for (const quien of [EMPLEADO, JUAN, DUENO]) {
      await h.conRol(como(quien), () =>
        esperarError(
          db.query(`update perfiles set es_admin = true, es_dueno = true where id = $1`, [quien]),
          SIN_PERMISO,
        ),
      );
    }
    await h.conRol(ANON, () =>
      esperarError(db.query(`update perfiles set es_admin = true`), SIN_PERMISO),
    );
    const r = await h.filas<{ id: string }>(`select id from perfiles where es_admin`);
    expect(r.map((p) => p.id)).toEqual([ADMIN]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("admin: ve y configura todo como el dueño", () => {
  it("es barbero y dueño para todos los chequeos", async () => {
    const r = await h.conRol(como(ADMIN), () =>
      h.fila<{ b: boolean; d: boolean }>(`select es_barbero() as b, es_dueno() as d`),
    );
    expect(r).toEqual({ b: true, d: true });
  });

  it("lee todos los perfiles, cortes (con montos), canjes y descuentos", async () => {
    const contar = async (quien: string, tabla: string) =>
      (
        await h.conRol(como(quien), () =>
          h.fila<{ n: number }>(`select count(*)::int as n from ${tabla}`),
        )
      ).n;
    for (const tabla of ["perfiles", "cortes", "canjes", "descuentos_asociados", "reglas"]) {
      expect(await contar(ADMIN, tabla)).toBe(await contar(DUENO, tabla));
    }
    const conMonto = await h.conRol(como(ADMIN), () =>
      h.fila<{ n: number }>(`select count(*)::int as n from cortes where monto is not null`),
    );
    expect(conMonto.n).toBeGreaterThan(0);
  });

  it("ve las métricas y la caja igual que el dueño", async () => {
    const metricas = (quien: string) =>
      h.conRol(como(quien), () => h.fila(`select * from metricas_panel()`));
    expect(await metricas(ADMIN)).toEqual(await metricas(DUENO));
    const caja = (quien: string) =>
      h.conRol(como(quien), () =>
        h.filas(`select * from facturacion(current_date - 365, current_date)`),
      );
    expect(await caja(ADMIN)).toEqual(await caja(DUENO));
  });

  it("edita precios, la regla de premios y los descuentos", async () => {
    await h.conRol(como(ADMIN), async () => {
      await db.query(`select guardar_precio_cliente($1, 9500)`, [JUAN]);
      await db.query(`select guardar_regla_etapas($1)`, [
        JSON.stringify([
          { corte: 4, descripcion: "20% off" },
          { corte: 10, descripcion: "Corte gratis" },
        ]),
      ]);
      await db.query(
        `insert into descuentos_asociados (comercio, descripcion, vigente_desde) values ('Kiosco', '10% off', current_date)`,
      );
    });
    const precio = await h.fila<{ p: string }>(
      `select precio_habitual as p from perfiles where id = $1`,
      [JUAN],
    );
    expect(Number(precio.p)).toBe(9500);
    const regla = await h.fila<{ etapas: unknown[] }>(`select etapas from reglas where activa`);
    expect(regla.etapas).toHaveLength(2);
  });

  it("ve y maneja la agenda y los horarios de los dos barberos", async () => {
    await h.conRol(como(ADMIN), async () => {
      await db.query(`select guardar_horario_semanal($1, $2)`, [EMPLEADO, JSON.stringify(HORARIO)]);
      await db.query(`select guardar_dia_especial($1, $2, '[]', 'Feriado')`, [DUENO, MIERCOLES]);
      await db.query(`select borrar_dia_especial($1, $2)`, [DUENO, MIERCOLES]);
      const t = await h.fila<{ id: string; barbero_id: string; creado_por: string }>(
        `select * from reservar_para_cliente($1, $2, $3)`,
        [DUENO, MARTIN, ar(MANANA, "10:00")],
      );
      expect(t).toMatchObject({ barbero_id: DUENO, creado_por: ADMIN });
      await db.query(`select bloquear_horario($1, $2, $3, 'Trámite')`, [
        EMPLEADO,
        ar(MANANA, "11:00"),
        ar(MANANA, "12:00"),
      ]);
      const agenda = await h.filas<{ tipo: string }>(`select * from agenda_dia($1, $2)`, [
        DUENO,
        MANANA,
      ]);
      expect(agenda.find((f) => f.tipo === "reserva")).toBeTruthy();
      const cancelado = await h.fila<{ estado: string }>(`select * from cancelar_turno($1)`, [
        t.id,
      ]);
      expect(cancelado.estado).toBe("cancelado");
      const horarios = await h.filas<{ barbero_id: string }>(
        `select distinct barbero_id from horarios_semanales order by 1`,
      );
      expect(horarios.map((x) => x.barbero_id)).toEqual([DUENO, EMPLEADO]);
      const turnos = await h.filas(`select * from turnos`);
      expect(turnos.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("suma un corte (soporte): queda a su nombre y lo puede deshacer", async () => {
    const corte = await h.conRol(como(ADMIN), () =>
      h.fila<{ id: string; registrado_por: string }>(
        `select * from registrar_corte($1, null, 7000)`,
        [NICOLAS],
      ),
    );
    expect(corte.registrado_por).toBe(ADMIN);
    await h.conRol(como(ADMIN), () => db.query(`select deshacer_corte($1)`, [corte.id]));
    const r = await h.filas(`select 1 from cortes where id = $1`, [corte.id]);
    expect(r).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("admin: no es barbero que atiende", () => {
  it("no aparece entre los barberos para sacar turno, aunque tuviera horario cargado", async () => {
    // Un horario del admin cargado "por la puerta de atrás" (SQL directo).
    await db.query(
      `insert into horarios_semanales (barbero_id, dia_semana, desde, hasta, duracion_min) values ($1, 2, '10:00', '13:00', 30)`,
      [ADMIN],
    );
    const barberos = await h.conRol(como(JUAN), () =>
      h.filas<{ id: string }>(`select * from barberos_turnos()`),
    );
    expect(barberos.map((b) => b.id)).toEqual([DUENO, EMPLEADO]);
    const libres = await h.conRol(como(JUAN), () =>
      h.filas(`select * from horarios_libres($1)`, [ADMIN]),
    );
    expect(libres).toEqual([]);
    await db.query(`delete from horarios_semanales where barbero_id = $1`, [ADMIN]);
  });

  it("un cliente no puede reservar con el admin", async () => {
    await h.conRol(como(JUAN), () =>
      esperarError(
        db.query(`select * from reservar_turno($1, $2)`, [ADMIN, ar(MANANA, "10:00")]),
        NO_EXISTE,
      ),
    );
  });

  it("nadie le puede cargar horarios, días especiales, bloqueos ni turnos", async () => {
    for (const quien of [ADMIN, DUENO]) {
      await h.conRol(como(quien), async () => {
        await esperarError(
          db.query(`select guardar_horario_semanal($1, $2)`, [ADMIN, JSON.stringify(HORARIO)]),
          NO_EXISTE,
        );
        await esperarError(
          db.query(`select guardar_dia_especial($1, $2, $3)`, [
            ADMIN,
            MIERCOLES,
            JSON.stringify([{ desde: "10:00", hasta: "12:00", duracion_min: 30 }]),
          ]),
          NO_EXISTE,
        );
        await esperarError(
          db.query(`select bloquear_horario($1, $2, $3)`, [
            ADMIN,
            ar(MANANA, "15:00"),
            ar(MANANA, "16:00"),
          ]),
          NO_EXISTE,
        );
        await esperarError(
          db.query(`select reservar_para_cliente($1, $2, $3)`, [ADMIN, JUAN, ar(MANANA, "10:30")]),
          NO_EXISTE,
        );
        await esperarError(
          db.query(`select * from agenda_dia($1, $2)`, [ADMIN, MANANA]),
          NO_EXISTE,
        );
      });
    }
    const propios = await h.fila<{ n: number }>(
      `select (select count(*) from horarios_semanales where barbero_id = $1)
            + (select count(*) from dias_especiales where barbero_id = $1)
            + (select count(*) from turnos where barbero_id = $1) as n`,
      [ADMIN],
    );
    expect(Number(propios.n)).toBe(0);
  });

  it("no activa notificaciones (no tiene turnos); el dueño sí", async () => {
    const sub = ["https://push.ejemplo.com/abc", "p256dh-de-prueba", "auth-prueba"];
    await h.conRol(como(ADMIN), () =>
      esperarError(db.query(`select guardar_suscripcion_push($1, $2, $3)`, sub), /no_autorizado/),
    );
    await h.conRol(como(DUENO), () => db.query(`select guardar_suscripcion_push($1, $2, $3)`, sub));
    const r = await h.filas<{ barbero_id: string }>(`select barbero_id from suscripciones_push`);
    expect(r.map((s) => s.barbero_id)).toEqual([DUENO]);
  });

  it("en la caja aparece solo si cargó cortes, después de los barberos y marcado como admin", async () => {
    const caja = () =>
      h.conRol(como(DUENO), () =>
        h.filas<{ barbero_id: string | null; es_admin: boolean; cortes: number; total: string }>(
          `select * from facturacion(current_date - 365, current_date)`,
        ),
      );
    expect((await caja()).map((f) => f.barbero_id)).toEqual([DUENO, EMPLEADO]);

    await db.exec(
      `update cortes set fecha = fecha - interval '2 minutes' where cliente_id = '${NICOLAS}'`,
    );
    await h.conRol(como(ADMIN), () =>
      db.query(`select registrar_corte($1, null, 7000)`, [NICOLAS]),
    );

    const despues = await caja();
    expect(despues.map((f) => f.barbero_id)).toEqual([DUENO, EMPLEADO, ADMIN]);
    expect(despues.map((f) => f.es_admin)).toEqual([false, false, true]);
    expect(despues[2]).toMatchObject({ cortes: 1 });
    expect(Number(despues[2]?.total)).toBe(7000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("empleado, cliente y visitante: nada nuevo", () => {
  it("el empleado sigue sin caja y sin agenda ajena (tampoco la del admin)", async () => {
    await h.conRol(como(EMPLEADO), async () => {
      await esperarError(
        db.query(`select * from facturacion(current_date - 30, current_date)`),
        /no_autorizado/,
      );
      await esperarError(
        db.query(`select * from agenda_dia($1, $2)`, [DUENO, MANANA]),
        /no_autorizado/,
      );
      await esperarError(db.query(`select * from agenda_dia($1, $2)`, [ADMIN, MANANA]), NO_EXISTE);
      // No ve los cortes que cargó el admin.
      const r = await h.filas(`select 1 from cortes where registrado_por = $1`, [ADMIN]);
      expect(r).toEqual([]);
    });
  });

  it("un cliente no ve el perfil del admin ni puede usar la caja", async () => {
    await h.conRol(como(JUAN), async () => {
      expect(await h.filas(`select * from perfiles where id = $1`, [ADMIN])).toEqual([]);
      const propio = await h.fila<{ es_admin: boolean }>(`select es_admin from perfiles`);
      expect(propio.es_admin).toBe(false);
      await esperarError(
        db.query(`select * from facturacion(current_date - 30, current_date)`),
        /no_autorizado/,
      );
    });
  });

  it("un visitante no puede ejecutar nada de esto", async () => {
    await h.conRol(ANON, async () => {
      await esperarError(db.query(`select * from perfiles`), SIN_PERMISO);
      await esperarError(db.query(`select * from barberos_turnos()`), SIN_PERMISO);
      await esperarError(
        db.query(`select * from facturacion(current_date - 30, current_date)`),
        SIN_PERMISO,
      );
      await esperarError(db.query(`select _es_barbero_id($1)`, [DUENO]), SIN_PERMISO);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Producción: la migración sobre una base con datos, y después los scripts.
// ════════════════════════════════════════════════════════════════════════════
describe("migración sobre una base con datos (como producción)", () => {
  it("no cambia nada para nadie; marcar-admin y crear-barbero hacen lo que dicen", async () => {
    const base = await nuevaBase({ hasta: MIGRACION_ADMIN, seed: false });
    const { conRol, filas, fila } = herramientas(base);
    const DESARROLLADOR = DUENO; // hoy, la única cuenta "dueño"
    const LEANDRO = "b0000000-0000-4000-8000-000000000009"; // el dueño real (cuenta nueva)

    try {
      // Producción antes de la migración: el dueño (cuenta del desarrollador),
      // el empleado, clientes, cortes con y sin monto, horarios y turnos.
      await base.exec(`
        insert into auth.users (id, email) values
          ('${DESARROLLADOR}', 'dev@x.com'), ('${EMPLEADO}', 'empleado@x.com'),
          ('${JUAN}', 'juan@x.com'), ('${MARTIN}', 'martin@x.com'), ('${LEANDRO}', 'leandro@x.com');
        insert into perfiles (id, nombre, rol, debe_cambiar_password, es_dueno) values
          ('${DESARROLLADOR}', 'Martín', 'barbero', false, true),
          ('${EMPLEADO}', 'Nahuel', 'barbero', false, false);
        insert into perfiles (id, nombre, telefono, precio_habitual) values
          ('${JUAN}', 'Juan', '2346401122', 9000), ('${MARTIN}', 'Martín G', '2346402233', null);
        insert into cortes (cliente_id, fecha, registrado_por, monto) values
          ('${JUAN}', now() - interval '40 days', '${DESARROLLADOR}', null),
          ('${JUAN}', now() - interval '10 days', '${DESARROLLADOR}', 9000),
          ('${MARTIN}', now() - interval '5 days', '${EMPLEADO}', 8500);
      `);
      for (const b of [DESARROLLADOR, EMPLEADO]) {
        await conRol(como(b), () =>
          base.query(`select guardar_horario_semanal($1, $2)`, [b, JSON.stringify(HORARIO)]),
        );
      }
      await base.exec(`
        insert into turnos (barbero_id, cliente_id, inicio, fin, creado_por) values
          ('${DESARROLLADOR}', '${JUAN}', date_trunc('hour', now()) + interval '2 days', date_trunc('hour', now()) + interval '2 days 30 minutes', '${JUAN}');
        insert into turnos (barbero_id, tipo, inicio, fin, nota) values
          ('${DESARROLLADOR}', 'bloqueo', date_trunc('hour', now()) + interval '3 days', date_trunc('hour', now()) + interval '3 days 1 hour', 'Trámite');
      `);

      const foto = async () => ({
        perfiles: await filas(`select * from perfiles order by id`),
        cortes: await filas(`select * from cortes order by id`),
        turnos: await filas(`select * from turnos order by id`),
        caja: await conRol(como(DESARROLLADOR), () =>
          filas(
            `select barbero_id, barbero_nombre, es_dueno, cortes, cortes_sin_monto, total
             from facturacion(current_date - 365, current_date)`,
          ),
        ),
        metricas: await conRol(como(EMPLEADO), () => filas(`select * from metricas_panel()`)),
        barberos: await conRol(como(JUAN), () =>
          filas(`select id, nombre, es_dueno from barberos_turnos()`),
        ),
        libres: await conRol(como(JUAN), () =>
          filas(`select * from horarios_libres($1)`, [DESARROLLADOR]),
        ),
        agenda: await conRol(como(EMPLEADO), () =>
          filas(`select * from agenda_dia($1, current_date + 2)`, [EMPLEADO]),
        ),
        resumen: await conRol(como(DESARROLLADOR), () =>
          filas(`select * from resumen_clientes order by id`),
        ),
      });

      const antes = await foto();
      await base.exec(readFileSync(join(RAIZ, "migrations", MIGRACION_ADMIN), "utf8"));
      const despues = await foto();

      // Nadie quedó como admin y todo se ve igual (los perfiles suman la columna en false).
      expect(despues.perfiles).toEqual(antes.perfiles.map((p) => ({ ...p, es_admin: false })));
      expect({ ...despues, perfiles: null }).toEqual({ ...antes, perfiles: null });
      expect(antes.barberos).toHaveLength(2);

      // La app publicada sigue llamando a facturacion igual (suma una columna al final).
      const [primera] = await conRol(como(DESARROLLADOR), () =>
        filas(`select * from facturacion(p_desde => current_date - 30, p_hasta => current_date)`),
      );
      expect(Object.keys(primera!)).toEqual([
        "barbero_id",
        "barbero_nombre",
        "es_dueno",
        "cortes",
        "cortes_sin_monto",
        "total",
        "es_admin",
      ]);

      // ── marcar-admin.sql ──
      // Con un email que no es de un barbero, o con el del empleado: no cambia nada.
      await esperarError(
        base.exec(script("marcar-admin.sql", "nadie@x.com")),
        /No hay ningún barbero/,
      );
      await esperarError(
        base.exec(script("marcar-admin.sql", "juan@x.com")),
        /No hay ningún barbero/,
      );
      await esperarError(
        base.exec(script("marcar-admin.sql", "EMPLEADO@x.com")),
        /EMPLEADO, no del dueño/,
      );
      // Con un turno de un cliente por delante: avisa y no cambia nada.
      await esperarError(base.exec(script("marcar-admin.sql", "dev@x.com")), /1 turno\(s\)/);
      expect(await filas(`select id from perfiles where es_admin`)).toEqual([]);

      // Cancela el turno (como en la agenda) y lo vuelve a correr (dos veces: es repetible).
      const [turno] = await filas<{ id: string }>(`select id from turnos where tipo = 'reserva'`);
      await conRol(como(DESARROLLADOR), () => base.query(`select cancelar_turno($1)`, [turno!.id]));
      await base.exec(script("marcar-admin.sql", "Dev@x.com"));
      await base.exec(script("marcar-admin.sql", "dev@x.com"));

      expect(
        await filas(
          `select id, es_dueno, es_admin from perfiles where rol = 'barbero' order by id`,
        ),
      ).toEqual([
        { id: DESARROLLADOR, es_dueno: true, es_admin: true },
        { id: EMPLEADO, es_dueno: false, es_admin: false },
      ]);
      const restos = await fila<{ h: number; b: number }>(
        `select (select count(*)::int from horarios_semanales where barbero_id = $1) as h,
                (select count(*)::int from turnos where barbero_id = $1 and tipo = 'bloqueo' and estado <> 'cancelado') as b`,
        [DESARROLLADOR],
      );
      expect(restos).toEqual({ h: 0, b: 0 });
      // Sus cortes siguen a su nombre y la caja lo muestra como admin.
      const caja = await conRol(como(DESARROLLADOR), () =>
        filas<{ barbero_id: string; es_admin: boolean }>(
          `select barbero_id, es_admin from facturacion(current_date - 365, current_date)`,
        ),
      );
      expect(caja).toEqual([
        { barbero_id: EMPLEADO, es_admin: false },
        { barbero_id: DESARROLLADOR, es_admin: true },
      ]);
      // Para los clientes, solo queda el empleado.
      const barberos = await conRol(como(JUAN), () =>
        filas<{ id: string }>(`select id from barberos_turnos()`),
      );
      expect(barberos.map((b) => b.id)).toEqual([EMPLEADO]);

      // ── crear-barbero.sql: el dueño real, que atiende ──
      await base.exec(script("crear-barbero.sql", "leandro@x.com", "Leandro Ferreyra"));
      expect(
        await fila(`select rol, es_dueno, es_admin from perfiles where id = $1`, [LEANDRO]),
      ).toEqual({
        rol: "barbero",
        es_dueno: true,
        es_admin: false,
      });
      await conRol(como(LEANDRO), () =>
        base.query(`select guardar_horario_semanal($1, $2)`, [LEANDRO, JSON.stringify(HORARIO)]),
      );
      const conDueno = await conRol(como(JUAN), () =>
        filas<{ id: string }>(`select id from barberos_turnos()`),
      );
      expect(conDueno.map((b) => b.id)).toEqual([LEANDRO, EMPLEADO]);
      // El admin edita los horarios del dueño real.
      await conRol(como(DESARROLLADOR), () =>
        base.query(`select guardar_horario_semanal($1, '[]')`, [LEANDRO]),
      );

      // Si por error se corre crear-barbero.sql con el email del admin, sigue siendo admin.
      await base.exec(script("crear-barbero.sql", "dev@x.com", "Martín"));
      expect(
        await fila(`select es_dueno, es_admin from perfiles where id = $1`, [DESARROLLADOR]),
      ).toEqual({
        es_dueno: true,
        es_admin: true,
      });
    } finally {
      await base.close();
    }
  });
});
