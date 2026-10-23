/**
 * Tests de regresión de la auditoría de seguridad (migración
 * 20261025000100_seguridad.sql). Cada `it` reproduce un ataque de los informes
 * y verifica que ahora la base lo bloquea:
 *
 *   · sesión vieja después de un reseteo (revocar_sesiones, cambio pendiente)
 *   · empleado dado de baja con un token todavía válido (banned_until)
 *   · SSRF / amplificación con suscripciones push (allowlist, tope, apropiación)
 *   · spam de reservas y cancelaciones (avisos push al barbero)
 *   · límite de intentos de login (consumir_intento)
 *   · reusar la solicitud de un turno de otra agenda (reservar_para_cliente)
 *
 * Igual que los demás: PGlite con stubs de Supabase y cada rol simulado con
 * `set role` + `request.jwt.claims`.   npm run test:db
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const MIGRACION = "20261025000100_seguridad.sql";

const DUENO = "b0000000-0000-4000-8000-000000000001";
const EMPLEADO = "b0000000-0000-4000-8000-000000000002";
const JUAN = "c0000000-0000-4000-8000-000000000001";
const MARTIN = "c0000000-0000-4000-8000-000000000002";
const LUCAS = "c0000000-0000-4000-8000-000000000003";
const SANTIAGO = "c0000000-0000-4000-8000-000000000004";

// "Ahora" para las funciones de turnos: lunes 2/11/2026, 12:00 en Argentina.
const AHORA = "2026-11-02 12:00:00-03";
const ar = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-03:00`).toISOString();
const MARTES = "2026-11-03";
const MIERCOLES = "2026-11-04";

const HORARIO = [1, 2, 3, 4, 5, 6].map((dia) => ({
  dia_semana: dia,
  desde: "09:00",
  hasta: "20:00",
  duracion_min: 30,
}));

const FCM = (x: string) => `https://fcm.googleapis.com/fcm/send/${x}`;
const CLAVES = ["BElavePublicaDePrueba1234567890", "authDePrueba"] as const;

type Rol = { rol: "anon" } | { rol: "service_role" } | { rol: "authenticated"; sub: string };
const ANON: Rol = { rol: "anon" };
const SERVICIO: Rol = { rol: "service_role" };
const como = (sub: string): Rol => ({ rol: "authenticated", sub });

const SIN_PERMISO = /permission denied/;

async function nuevaBase({ hasta }: { hasta?: string } = {}) {
  const base = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
  await base.exec(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
  for (const archivo of readdirSync(join(RAIZ, "migrations")).sort()) {
    if (hasta && archivo >= hasta) continue;
    await base.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  await base.exec(readFileSync(join(RAIZ, "seed.sql"), "utf8"));
  return base;
}

function herramientas(base: PGlite) {
  async function conRol<T>(rol: Rol, fn: () => Promise<T>): Promise<T> {
    const claims =
      rol.rol === "authenticated" ? { role: "authenticated", sub: rol.sub } : { role: rol.rol };
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

const esperarError = (p: Promise<unknown>, patron: RegExp) => expect(p).rejects.toThrow(patron);

// ════════════════════════════════════════════════════════════════════════════
describe("migración sobre una base con datos", () => {
  it("borra las suscripciones que no son de un servicio push y deja hasta 10 por barbero", async () => {
    const base = await nuevaBase({ hasta: MIGRACION });
    const h = herramientas(base);
    try {
      const insertar = (barbero: string, endpoint: string, minutos: number) =>
        base.query(
          `insert into suscripciones_push (barbero_id, endpoint, p256dh, auth, actualizada_en)
           values ($1, $2, $3, $4, now() - make_interval(mins => $5))`,
          [barbero, endpoint, ...CLAVES, minutos],
        );
      // Lo que dejó entrar la versión anterior (ataque SSRF del informe).
      await insertar(EMPLEADO, "https://127.0.0.1:8443/ssrf", 1);
      await insertar(EMPLEADO, "https://169.254.169.254/latest/meta-data/", 1);
      await insertar(EMPLEADO, "https://ssrf-prueba.127.0.0.1.nip.io:8443/x", 1);
      for (let i = 0; i < 12; i++) await insertar(EMPLEADO, FCM(`empleado-${i}`), i);
      await insertar(DUENO, "https://web.push.apple.com/QGuQyavXutnMH", 5);
      await insertar(DUENO, "https://updates.push.services.mozilla.com/wpush/v2/gAAAA", 5);
      const perfilesAntes = await h.fila<{ n: number }>(`select count(*)::int as n from perfiles`);

      await base.exec(readFileSync(join(RAIZ, "migrations", MIGRACION), "utf8"));

      const empleado = await h.filas<{ endpoint: string }>(
        `select endpoint from suscripciones_push where barbero_id = $1 order by actualizada_en desc`,
        [EMPLEADO],
      );
      expect(empleado.map((s) => s.endpoint)).toEqual(
        Array.from({ length: 10 }, (_, i) => FCM(`empleado-${i}`)),
      );
      const dueno = await h.filas(`select 1 from suscripciones_push where barbero_id = $1`, [
        DUENO,
      ]);
      expect(dueno).toHaveLength(2);
      expect(await h.fila(`select count(*)::int as n from perfiles`)).toEqual(perfilesAntes);
    } finally {
      await base.close();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("con la migración aplicada", () => {
  let db: PGlite;
  let h: ReturnType<typeof herramientas>;

  beforeAll(async () => {
    db = await nuevaBase();
    h = herramientas(db);
    await db.exec(`create or replace function public._ahora() returns timestamptz
      language sql stable set search_path = '' as $$ select '${AHORA}'::timestamptz $$;`);
    for (const b of [DUENO, EMPLEADO]) {
      await h.conRol(como(b), () =>
        db.query(`select guardar_horario_semanal($1, $2)`, [b, JSON.stringify(HORARIO)]),
      );
    }
  });
  afterAll(async () => db?.close());

  // ─── Permisos de lo nuevo ─────────────────────────────────────────────────
  describe("permisos", () => {
    it("ninguna función queda ejecutable por PUBLIC y anon solo ejecuta hoy_ar()", async () => {
      const r = await h.filas<{ f: string; anon: boolean; publico: boolean }>(`
        select p.oid::regprocedure::text as f,
               has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
               coalesce((select bool_or(a.grantee = 0)
                         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a), false) as publico
        from pg_proc p where p.pronamespace = 'public'::regnamespace`);
      expect(r.filter((x) => x.publico)).toEqual([]);
      expect(r.filter((x) => x.anon).map((x) => x.f)).toEqual(["hoy_ar()"]);
    });

    it("revocar_sesiones, consumir_intento y limpiar_intentos son solo del servidor", async () => {
      for (const rol of [ANON, como(JUAN), como(DUENO)]) {
        await h.conRol(rol, async () => {
          await esperarError(db.query(`select revocar_sesiones($1)`, [JUAN]), SIN_PERMISO);
          await esperarError(
            db.query(`select consumir_intento('login:cuenta:x', 10, 900)`),
            SIN_PERMISO,
          );
          await esperarError(db.query(`select limpiar_intentos('login:cuenta:x')`), SIN_PERMISO);
          await esperarError(db.query(`select * from intentos`), SIN_PERMISO);
        });
      }
    });
  });

  // ─── A1: sesión vieja después de un reseteo ───────────────────────────────
  describe("reseteo de contraseña: sesiones y cambio pendiente", () => {
    it("revocar_sesiones borra las sesiones y refresh tokens de ese usuario (y de nadie más)", async () => {
      await db.exec(`
        insert into auth.sessions (id, user_id) values
          ('5e000000-0000-4000-8000-000000000001', '${JUAN}'),
          ('5e000000-0000-4000-8000-000000000002', '${JUAN}'),
          ('5e000000-0000-4000-8000-000000000003', '${MARTIN}');
        insert into auth.refresh_tokens (token, user_id, session_id) values
          ('tok-juan-1', '${JUAN}', '5e000000-0000-4000-8000-000000000001'),
          ('tok-juan-2', '${JUAN}', '5e000000-0000-4000-8000-000000000002'),
          ('tok-juan-viejo', '${JUAN}', null),
          ('tok-martin', '${MARTIN}', '5e000000-0000-4000-8000-000000000003');`);

      const r = await h.conRol(SERVICIO, () =>
        h.fila<{ n: number }>(`select revocar_sesiones($1) as n`, [JUAN]),
      );
      expect(r.n).toBe(2);
      expect(await h.filas(`select 1 from auth.sessions where user_id = $1`, [JUAN])).toEqual([]);
      expect(await h.filas(`select 1 from auth.refresh_tokens where user_id = $1`, [JUAN])).toEqual(
        [],
      );
      expect(await h.filas<{ token: string }>(`select token from auth.refresh_tokens`)).toEqual([
        { token: "tok-martin" },
      ]);
    });

    it("con un cambio de contraseña pendiente, el cliente no reserva, no cancela ni ve su turno", async () => {
      const turno = await h.conRol(como(JUAN), () =>
        h.fila<{ id: string }>(`select * from reservar_turno($1, $2)`, [
          DUENO,
          ar(MIERCOLES, "17:00"),
        ]),
      );
      // El barbero le resetea la contraseña (la app pone el flag).
      await db.query(`update perfiles set debe_cambiar_password = true where id = $1`, [JUAN]);
      await h.conRol(como(JUAN), async () => {
        expect(await h.filas(`select * from mi_proximo_turno()`)).toEqual([]);
        await esperarError(
          db.query(`select cancelar_turno($1)`, [turno.id]),
          /cambio_password_pendiente/,
        );
        await esperarError(
          db.query(`select reservar_turno($1, $2)`, [DUENO, ar(MIERCOLES, "18:00")]),
          /cambio_password_pendiente/,
        );
        // Su propio perfil lo sigue leyendo (la app lo necesita para pedirle el cambio).
        expect(await h.filas(`select id from perfiles`)).toEqual([{ id: JUAN }]);
      });
      // Después de elegir la contraseña nueva, todo vuelve a funcionar.
      await db.query(`update perfiles set debe_cambiar_password = false where id = $1`, [JUAN]);
      await h.conRol(como(JUAN), async () => {
        expect(await h.filas(`select id from mi_proximo_turno()`)).toEqual([{ id: turno.id }]);
        await db.query(`select cancelar_turno($1)`, [turno.id]);
      });
    });

    it("un barbero con un cambio de contraseña pendiente no opera como barbero", async () => {
      await db.query(`update perfiles set debe_cambiar_password = true where id = $1`, [EMPLEADO]);
      try {
        await h.conRol(como(EMPLEADO), async () => {
          expect((await h.fila<{ es: boolean }>(`select es_barbero() as es`)).es).toBe(false);
          await esperarError(db.query(`select registrar_corte($1)`, [LUCAS]), /no_autorizado/);
        });
      } finally {
        await db.query(`update perfiles set debe_cambiar_password = false where id = $1`, [
          EMPLEADO,
        ]);
      }
    });

    it("el registro de reseteos lo ve solo el dueño", async () => {
      await db.query(`insert into reseteos_password (cliente_id, barbero_id) values ($1, $2)`, [
        JUAN,
        EMPLEADO,
      ]);
      const dueno = await h.conRol(como(DUENO), () =>
        h.filas<{ barbero_id: string }>(`select barbero_id from reseteos_password`),
      );
      expect(dueno).toEqual([{ barbero_id: EMPLEADO }]);
      for (const quien of [EMPLEADO, JUAN]) {
        expect(
          await h.conRol(como(quien), () => h.filas(`select * from reseteos_password`)),
        ).toEqual([]);
      }
      await h.conRol(como(EMPLEADO), () =>
        esperarError(
          db.query(`insert into reseteos_password (cliente_id) values ($1)`, [JUAN]),
          SIN_PERMISO,
        ),
      );
      await h.conRol(ANON, () =>
        esperarError(db.query(`select * from reseteos_password`), SIN_PERMISO),
      );
    });
  });

  // ─── M2: empleado dado de baja ─────────────────────────────────────────────
  describe("empleado bloqueado (quitar-empleado.sql)", () => {
    it("con su token todavía válido no lee clientes ni opera como barbero", async () => {
      // Lo que hace quitar-empleado.sql.
      await db.query(`update auth.users set banned_until = 'infinity' where id = $1`, [EMPLEADO]);
      try {
        await h.conRol(como(EMPLEADO), async () => {
          expect((await h.fila<{ es: boolean }>(`select es_barbero() as es`)).es).toBe(false);
          // Solo ve su propia fila: ni teléfonos ni nombres de los clientes.
          expect(await h.filas(`select id from perfiles`)).toEqual([{ id: EMPLEADO }]);
          expect(await h.filas(`select id from resumen_clientes`)).toEqual([]);
          await esperarError(db.query(`select registrar_corte($1)`, [LUCAS]), /no_autorizado/);
          await esperarError(
            db.query(`select canjear_premio($1, null, 5)`, [LUCAS]),
            /no_autorizado/,
          );
          await esperarError(
            db.query(`select reservar_para_cliente($1, $2, $3)`, [
              EMPLEADO,
              SANTIAGO,
              ar(MARTES, "10:00"),
            ]),
            /no_autorizado/,
          );
          await esperarError(
            db.query(`select guardar_suscripcion_push($1, $2, $3)`, [FCM("baja"), ...CLAVES]),
            /no_autorizado/,
          );
          expect(await h.filas(`select * from turnos`)).toEqual([]);
        });
      } finally {
        await db.query(`update auth.users set banned_until = null where id = $1`, [EMPLEADO]);
      }
    });

    it("un bloqueo vencido no le quita nada; el dueño bloqueado pierde la caja", async () => {
      await db.query(
        `update auth.users set banned_until = now() - interval '1 day' where id = $1`,
        [EMPLEADO],
      );
      await h.conRol(como(EMPLEADO), async () => {
        expect((await h.fila<{ es: boolean }>(`select es_barbero() as es`)).es).toBe(true);
      });
      await db.query(`update auth.users set banned_until = 'infinity' where id = $1`, [DUENO]);
      try {
        await h.conRol(como(DUENO), async () => {
          expect((await h.fila<{ es: boolean }>(`select es_dueno() as es`)).es).toBe(false);
          await esperarError(
            db.query(`select * from facturacion(current_date - 30, current_date)`),
            /no_autorizado/,
          );
        });
      } finally {
        await db.query(`update auth.users set banned_until = null where id = $1`, [DUENO]);
      }
    });
  });

  // ─── A2 / B3: suscripciones push ───────────────────────────────────────────
  describe("suscripciones push", () => {
    const guardar = (barbero: string, endpoint: string, claves: readonly string[] = CLAVES) =>
      h.conRol(como(barbero), () =>
        db.query(`select guardar_suscripcion_push($1, $2, $3)`, [endpoint, ...claves]),
      );

    it("acepta solo servicios push reales (FCM, Mozilla, Apple, Windows)", async () => {
      for (const endpoint of [
        FCM("abc:APA91b"),
        "https://android.googleapis.com/gcm/send/abc",
        "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk",
        "https://web.push.apple.com/QGuQyavXutnMH",
        "https://wns2-bl2p.notify.windows.com/w/?token=BQYAAAB",
      ]) {
        await guardar(EMPLEADO, endpoint);
      }
      for (const endpoint of [
        "https://127.0.0.1:8443/ssrf",
        "https://169.254.169.254/latest/meta-data/",
        "https://ssrf-prueba.127.0.0.1.nip.io:8443/x",
        "https://fcm.googleapis.com:8443/fcm/send/x",
        "https://fcm.googleapis.com.evil.example/x",
        "https://fcm.googleapis.com@evil.example/x",
        "https://evilfcm.googleapis.com/x",
        "https://push.apple.com.evil.example/x",
        "http://fcm.googleapis.com/fcm/send/x",
        "https://fcm.googleapis.com",
      ]) {
        await h.conRol(como(EMPLEADO), () =>
          esperarError(
            db.query(`select guardar_suscripcion_push($1, $2, $3)`, [endpoint, ...CLAVES]),
            /suscripcion_invalida/,
          ),
        );
      }
      // Ni siquiera el servidor puede guardar un endpoint que no sea de un servicio push.
      await h.conRol(SERVICIO, () =>
        esperarError(
          db.query(
            `insert into suscripciones_push (barbero_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)`,
            [EMPLEADO, "https://127.0.0.1:8443/x", ...CLAVES],
          ),
          /suscripciones_endpoint_valido/,
        ),
      );
    });

    it("guarda hasta 10 dispositivos por barbero (se va el más viejo)", async () => {
      for (let i = 0; i < 15; i++) {
        await guardar(EMPLEADO, FCM(`tope-${i}`));
        await new Promise((r) => setTimeout(r, 2)); // fechas distintas para ordenar
      }
      const r = await h.filas<{ endpoint: string }>(
        `select endpoint from suscripciones_push where barbero_id = $1`,
        [EMPLEADO],
      );
      expect(r).toHaveLength(10);
      expect(r.map((s) => s.endpoint)).toContain(FCM("tope-14"));
      expect(r.map((s) => s.endpoint)).not.toContain(FCM("tope-4"));
    });

    it("un barbero no se apropia del dispositivo de otro conociendo solo el endpoint", async () => {
      const ENDPOINT = FCM("dueno-123");
      await guardar(DUENO, ENDPOINT, ["1234567890-dueno", "abcd-dueno"]);
      await h.conRol(como(EMPLEADO), () =>
        esperarError(
          db.query(`select guardar_suscripcion_push($1, $2, $3)`, [ENDPOINT, "9999999999", "zzzz"]),
          /suscripcion_invalida/,
        ),
      );
      expect(
        await h.filas(`select barbero_id, p256dh from suscripciones_push where endpoint = $1`, [
          ENDPOINT,
        ]),
      ).toEqual([{ barbero_id: DUENO, p256dh: "1234567890-dueno" }]);

      // El mismo navegador (mismas claves) sí puede pasar de un barbero a otro.
      await guardar(EMPLEADO, ENDPOINT, ["1234567890-dueno", "abcd-dueno"]);
      expect(
        await h.filas(`select barbero_id from suscripciones_push where endpoint = $1`, [ENDPOINT]),
      ).toEqual([{ barbero_id: EMPLEADO }]);
    });
  });

  // ─── M2 (informe de entrada): spam de reservas y cancelaciones ────────────
  describe("spam de turnos", () => {
    const horas = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"];

    it("el cliente cancela hasta 3 veces cada 24 h; después tiene que escribir por WhatsApp", async () => {
      for (let i = 0; i < 3; i++) {
        const t = await h.conRol(como(MARTIN), () =>
          h.fila<{ id: string }>(`select * from reservar_turno($1, $2)`, [
            EMPLEADO,
            ar(MARTES, horas[i]!),
          ]),
        );
        await h.conRol(como(MARTIN), () => db.query(`select cancelar_turno($1)`, [t.id]));
      }
      const cuarto = await h.conRol(como(MARTIN), () =>
        h.fila<{ id: string }>(`select * from reservar_turno($1, $2)`, [
          EMPLEADO,
          ar(MARTES, horas[3]!),
        ]),
      );
      await h.conRol(como(MARTIN), () =>
        esperarError(
          db.query(`select cancelar_turno($1)`, [cuarto.id]),
          /demasiadas_cancelaciones/,
        ),
      );
      const estado = await h.fila<{ estado: string }>(`select estado from turnos where id = $1`, [
        cuarto.id,
      ]);
      expect(estado.estado).toBe("reservado");
      // El barbero sí lo puede cancelar (no cuenta para el cliente).
      await h.conRol(como(EMPLEADO), () => db.query(`select cancelar_turno($1)`, [cuarto.id]));
    });

    it("el cliente reserva hasta 5 veces cada 24 h; repetir la misma solicitud sigue andando", async () => {
      // Martín ya reservó 4 veces en el test anterior.
      const solicitud = "e0000000-0000-4000-8000-0000000000f1";
      const quinto = await h.conRol(como(MARTIN), () =>
        h.fila<{ id: string }>(`select * from reservar_turno($1, $2, $3)`, [
          EMPLEADO,
          ar(MARTES, horas[4]!),
          solicitud,
        ]),
      );
      await h.conRol(como(EMPLEADO), () => db.query(`select cancelar_turno($1)`, [quinto.id]));
      await h.conRol(como(MARTIN), async () => {
        await esperarError(
          db.query(`select reservar_turno($1, $2)`, [EMPLEADO, ar(MARTES, horas[5]!)]),
          /demasiadas_reservas/,
        );
        // Un reintento de la misma solicitud devuelve el turno (idempotencia).
        const otra = await h.fila<{ id: string }>(`select * from reservar_turno($1, $2, $3)`, [
          EMPLEADO,
          ar(MARTES, horas[4]!),
          solicitud,
        ]);
        expect(otra.id).toBe(quinto.id);
      });
      // Otro cliente no se ve afectado.
      await h.conRol(como(SANTIAGO), () =>
        db.query(`select reservar_turno($1, $2)`, [EMPLEADO, ar(MARTES, horas[5]!)]),
      );
    });
  });

  // ─── B4: idempotencia de reservar_para_cliente ─────────────────────────────
  describe("reservar_para_cliente", () => {
    it("reusar la solicitud de un turno de otra agenda no devuelve ese turno", async () => {
      const S = "e0000000-0000-4000-8000-0000000000aa";
      const delDueno = await h.conRol(como(DUENO), () =>
        h.fila<{ id: string }>(`select * from reservar_para_cliente($1, $2, $3, $4)`, [
          DUENO,
          LUCAS,
          ar(MIERCOLES, "09:00"),
          S,
        ]),
      );
      await h.conRol(como(EMPLEADO), () =>
        esperarError(
          db.query(`select * from reservar_para_cliente($1, $2, $3, $4)`, [
            EMPLEADO,
            LUCAS,
            ar(MIERCOLES, "09:00"),
            S,
          ]),
          /solicitud_invalida/,
        ),
      );
      // El reintento del propio dueño sigue siendo idempotente.
      const otra = await h.conRol(como(DUENO), () =>
        h.fila<{ id: string }>(`select * from reservar_para_cliente($1, $2, $3, $4)`, [
          DUENO,
          LUCAS,
          ar(MIERCOLES, "09:00"),
          S,
        ]),
      );
      expect(otra.id).toBe(delDueno.id);
    });
  });

  // ─── M1: límite de intentos ────────────────────────────────────────────────
  describe("consumir_intento", () => {
    const consumir = (clave: string, max: number, ventana: number) =>
      h
        .conRol(SERVICIO, () =>
          h.fila<{ espera: number }>(`select consumir_intento($1, $2, $3) as espera`, [
            clave,
            max,
            ventana,
          ]),
        )
        .then((r) => r.espera);

    it("deja pasar hasta el máximo y después dice cuánto esperar", async () => {
      const clave = "login:cuenta:2346401122@clientes.local";
      for (let i = 0; i < 10; i++) expect(await consumir(clave, 10, 900)).toBe(0);
      const espera = await consumir(clave, 10, 900);
      expect(espera).toBeGreaterThan(890);
      expect(espera).toBeLessThanOrEqual(900);
      // Los intentos rechazados no se guardan (no alargan el bloqueo).
      await consumir(clave, 10, 900);
      const n = await h.fila<{ n: number }>(
        `select count(*)::int as n from intentos where clave = $1`,
        [clave],
      );
      expect(n.n).toBe(10);
      // Otra clave no se ve afectada.
      expect(await consumir("login:cuenta:otro@clientes.local", 10, 900)).toBe(0);
    });

    it("los intentos viejos no cuentan y los de más de un día se borran", async () => {
      const clave = "login:ip:203.0.113.7";
      await db.query(
        `insert into intentos (clave, en)
         select $1, now() - interval '11 minutes' from generate_series(1, 20)`,
        [clave],
      );
      await db.query(`insert into intentos (clave, en) values ($1, now() - interval '2 days')`, [
        "vieja",
      ]);
      expect(await consumir(clave, 20, 600)).toBe(0);
      expect(await h.filas(`select 1 from intentos where clave = 'vieja'`)).toEqual([]);
    });

    it("limpiar_intentos borra la cuenta entera o solo el último intento de la IP", async () => {
      const cuenta = "login:cuenta:limpiar@clientes.local";
      const ip = "login:ip:198.51.100.1";
      for (let i = 0; i < 3; i++) {
        await consumir(cuenta, 10, 900);
        await consumir(ip, 20, 600);
      }
      await h.conRol(SERVICIO, async () => {
        await db.query(`select limpiar_intentos($1)`, [cuenta]);
        await db.query(`select limpiar_intentos($1, true)`, [ip]);
      });
      const r = await h.filas<{ clave: string; n: number }>(
        `select clave, count(*)::int as n from intentos where clave in ($1, $2) group by clave`,
        [cuenta, ip],
      );
      expect(r).toEqual([{ clave: ip, n: 2 }]);
    });

    it("rechaza datos inválidos", async () => {
      await esperarError(consumir("", 10, 900), /datos_invalidos/);
      await esperarError(consumir("x", 0, 900), /datos_invalidos/);
      await esperarError(consumir("x", 10, 0), /datos_invalidos/);
      await esperarError(consumir("x".repeat(201), 10, 900), /datos_invalidos/);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("supabase/quitar-empleado.sql", () => {
  it("bloquea al empleado, cierra sus sesiones y le quita los permisos en el acto", async () => {
    const base = await nuevaBase();
    const h = herramientas(base);
    try {
      await base.exec(`
        insert into auth.sessions (user_id) values ('${EMPLEADO}'), ('${EMPLEADO}'), ('${DUENO}');
        insert into auth.refresh_tokens (token, user_id, session_id)
          select 'tok-' || id, user_id::text, id from auth.sessions;`);
      const script = readFileSync(join(RAIZ, "quitar-empleado.sql"), "utf8").replaceAll(
        "empleado@ejemplo.com",
        "empleado@faebarbershop.test",
      );
      await base.exec(script);

      const u = await h.fila<{ bloqueado: boolean }>(
        `select banned_until = 'infinity' as bloqueado from auth.users where id = $1`,
        [EMPLEADO],
      );
      expect(u.bloqueado).toBe(true);
      expect(await h.filas(`select 1 from auth.sessions where user_id = $1`, [EMPLEADO])).toEqual(
        [],
      );
      expect(
        await h.filas(`select 1 from auth.refresh_tokens where user_id = $1`, [EMPLEADO]),
      ).toEqual([]);
      // El dueño no se toca.
      expect(await h.filas(`select 1 from auth.sessions where user_id = $1`, [DUENO])).toHaveLength(
        1,
      );
      await h.conRol(como(EMPLEADO), async () => {
        expect((await h.fila<{ es: boolean }>(`select es_barbero() as es`)).es).toBe(false);
        expect(await h.filas(`select id from perfiles`)).toEqual([{ id: EMPLEADO }]);
      });
      await h.conRol(como(DUENO), async () => {
        expect((await h.fila<{ es: boolean }>(`select es_dueno() as es`)).es).toBe(true);
      });
    } finally {
      await base.close();
    }
  });
});
