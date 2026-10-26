/**
 * Tests de la base para SERVICIOS Y PRECIOS (migración 20261029000100_servicios.sql).
 *
 *   · Cada barbero maneja sus servicios; el dueño (y el admin), los de cualquiera.
 *   · Quién ve qué (RLS): los activos, cualquier usuario logueado; los pausados,
 *     su barbero y el dueño.
 *   · reservar_turno pide un servicio si el barbero ofrece alguno, lo valida y
 *     guarda una copia (nombre y precio) que no cambia aunque cambie el precio.
 *
 * Igual que los demás: PGlite con stubs de Supabase y cada rol simulado con
 * `set role` + `request.jwt.claims`. "Ahora" es el lunes 2/11/2026 a las 12:00.
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
const MIGRACION = "20261029000100_servicios.sql";

const DUENO = "b0000000-0000-4000-8000-000000000001";
const EMPLEADO = "b0000000-0000-4000-8000-000000000002";
const ADMIN = "b0000000-0000-4000-8000-000000000003";
const JUAN = "c0000000-0000-4000-8000-000000000001";
const MARTIN = "c0000000-0000-4000-8000-000000000002";
const LUCAS = "c0000000-0000-4000-8000-000000000003";
const SANTIAGO = "c0000000-0000-4000-8000-000000000004";
const FACUNDO = "c0000000-0000-4000-8000-000000000005";

const AHORA = "2026-11-02 12:00:00-03";
const MARTES = "2026-11-03";
const MIERCOLES = "2026-11-04";
const ar = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-03:00`).toISOString();

const HORARIO = [1, 2, 3, 4, 5, 6].map((dia) => ({
  dia_semana: dia,
  desde: "09:00",
  hasta: "20:00",
  duracion_min: 30,
}));

type Rol = { rol: "anon" } | { rol: "authenticated"; sub: string };
const ANON: Rol = { rol: "anon" };
const como = (sub: string): Rol => ({ rol: "authenticated", sub });
const SIN_PERMISO = /permission denied/;

type Servicio = {
  id: string;
  barbero_id: string;
  nombre: string;
  descripcion: string | null;
  precio: string;
  activo: boolean;
  orden: number;
};
type TurnoRow = {
  id: string;
  barbero_id: string;
  servicio_id: string | null;
  servicio_nombre: string | null;
  servicio_precio: string | null;
};

async function nuevaBase({ hasta }: { hasta?: string } = {}) {
  const base = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
  await base.exec(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
  for (const archivo of readdirSync(join(RAIZ, "migrations")).sort()) {
    if (hasta && archivo >= hasta) continue;
    await base.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  await base.exec(readFileSync(join(RAIZ, "seed.sql"), "utf8"));
  await base.exec(`create or replace function public._ahora() returns timestamptz
    language sql stable set search_path = '' as $$ select '${AHORA}'::timestamptz $$;`);
  return base;
}

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

const esperarError = (p: Promise<unknown>, patron: RegExp) => expect(p).rejects.toThrow(patron);

// ════════════════════════════════════════════════════════════════════════════
describe("migración sobre una base con datos", () => {
  it("no toca los turnos que ya había y la app vieja sigue reservando igual", async () => {
    const base = await nuevaBase({ hasta: MIGRACION });
    const h = herramientas(base);
    try {
      await h.conRol(como(EMPLEADO), () =>
        base.query(`select guardar_horario_semanal($1, $2)`, [EMPLEADO, JSON.stringify(HORARIO)]),
      );
      const viejo = await h.conRol(como(JUAN), () =>
        h.fila<{ id: string }>(`select * from reservar_turno($1, $2)`, [
          EMPLEADO,
          ar(MARTES, "10:00"),
        ]),
      );

      await base.exec(readFileSync(join(RAIZ, "migrations", MIGRACION), "utf8"));

      const t = await h.fila<TurnoRow & { estado: string }>(`select * from turnos where id = $1`, [
        viejo.id,
      ]);
      expect(t.estado).toBe("reservado");
      expect(t.servicio_id).toBeNull();
      expect(t.servicio_nombre).toBeNull();

      // Como la llama la app publicada (por nombre, sin p_servicio).
      const nuevo = await h.conRol(como(MARTIN), () =>
        h.fila<TurnoRow>(
          `select * from reservar_turno(p_barbero => $1, p_inicio => $2, p_solicitud_id => $3)`,
          [EMPLEADO, ar(MARTES, "11:00"), "5e000000-0000-4000-8000-0000000000aa"],
        ),
      );
      expect(nuevo.servicio_nombre).toBeNull();

      // Queda una sola versión de reservar_turno (si no, PostgREST no sabría cuál llamar).
      const versiones = await h.filas(
        `select 1 from pg_proc where proname = 'reservar_turno' and pronamespace = 'public'::regnamespace`,
      );
      expect(versiones).toHaveLength(1);

      // El cliente sigue viendo su turno (mi_proximo_turno recreada, con permisos).
      const mio = await h.conRol(como(JUAN), () =>
        h.fila<{ id: string; servicio_nombre: string | null }>(`select * from mi_proximo_turno()`),
      );
      expect(mio.id).toBe(viejo.id);
      expect(mio.servicio_nombre).toBeNull();
    } finally {
      await base.close();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("con la migración aplicada", () => {
  let db: PGlite;
  let h: ReturnType<typeof herramientas>;

  const crear = (quien: string, barbero: string, nombre: string, precio: number, desc?: string) =>
    h.conRol(como(quien), () =>
      h.fila<Servicio>(`select * from crear_servicio($1, $2, $3, $4)`, [
        barbero,
        nombre,
        precio,
        desc ?? null,
      ]),
    );
  const editar = (quien: string, id: string, nombre: string, precio: number, desc?: string) =>
    h.conRol(como(quien), () =>
      h.fila<Servicio>(`select * from editar_servicio($1, $2, $3, $4)`, [
        id,
        nombre,
        precio,
        desc ?? null,
      ]),
    );
  const activar = (quien: string, id: string, activo: boolean) =>
    h.conRol(como(quien), () =>
      h.fila<Servicio>(`select * from activar_servicio($1, $2)`, [id, activo]),
    );
  const borrar = (quien: string, id: string) =>
    h.conRol(como(quien), () => db.query(`select borrar_servicio($1)`, [id]));
  const reservar = (cliente: string, barbero: string, inicio: string, servicio?: string | null) =>
    h.conRol(como(cliente), () =>
      h.fila<TurnoRow>(`select * from reservar_turno($1, $2, null, $3)`, [
        barbero,
        inicio,
        servicio ?? null,
      ]),
    );
  const cancelar = (quien: string, turno: string) =>
    h.conRol(como(quien), () => db.query(`select cancelar_turno($1)`, [turno]));
  const visibles = (rol: Rol) =>
    h.conRol(rol, () => h.filas<Servicio>(`select * from servicios order by barbero_id, orden`));

  // Los servicios de cada barbero, para los tests de reservas.
  let corteDueno: Servicio;
  let barbaDueno: Servicio;
  let corteEmpleado: Servicio;
  let pausadoEmpleado: Servicio;

  beforeAll(async () => {
    db = await nuevaBase();
    h = herramientas(db);
    for (const b of [DUENO, EMPLEADO]) {
      await h.conRol(como(b), () =>
        db.query(`select guardar_horario_semanal($1, $2)`, [b, JSON.stringify(HORARIO)]),
      );
    }
  });
  afterAll(async () => db?.close());

  // ─── ABM ──────────────────────────────────────────────────────────────────
  describe("cada barbero maneja sus servicios", () => {
    it("el empleado crea, edita, pausa y borra los suyos", async () => {
      const s = await crear(EMPLEADO, EMPLEADO, "  Corte   clásico ", 8000.004, "Tijera y máquina");
      expect(s.barbero_id).toBe(EMPLEADO);
      expect(s.nombre).toBe("Corte clásico");
      expect(Number(s.precio)).toBe(8000);
      expect(s.activo).toBe(true);
      expect(s.orden).toBe(1);

      const e = await editar(EMPLEADO, s.id, "Corte clásico", 8500.5, "  ");
      expect(Number(e.precio)).toBe(8500.5);
      expect(e.descripcion).toBeNull();

      expect((await activar(EMPLEADO, s.id, false)).activo).toBe(false);
      expect((await activar(EMPLEADO, s.id, true)).activo).toBe(true);

      await borrar(EMPLEADO, s.id);
      expect(await h.filas(`select 1 from servicios where id = $1`, [s.id])).toEqual([]);
    });

    it("valida nombre, descripción, precio y nombres repetidos", async () => {
      await esperarError(crear(EMPLEADO, EMPLEADO, "X", 8000), /servicio_nombre_invalido/);
      await esperarError(
        crear(EMPLEADO, EMPLEADO, "a".repeat(61), 8000),
        /servicio_nombre_invalido/,
      );
      await esperarError(
        crear(EMPLEADO, EMPLEADO, "Corte", 8000, "a".repeat(141)),
        /servicio_descripcion_invalida/,
      );
      await esperarError(crear(EMPLEADO, EMPLEADO, "Corte", 0), /servicio_precio_invalido/);
      await esperarError(crear(EMPLEADO, EMPLEADO, "Corte", -100), /servicio_precio_invalido/);
      await esperarError(
        crear(EMPLEADO, EMPLEADO, "Corte", 10_000_000),
        /servicio_precio_invalido/,
      );

      const s = await crear(EMPLEADO, EMPLEADO, "Barba", 4000);
      await esperarError(crear(EMPLEADO, EMPLEADO, "  BARBA ", 5000), /servicio_repetido/);
      const otro = await crear(EMPLEADO, EMPLEADO, "Cejas", 2000);
      await esperarError(editar(EMPLEADO, otro.id, "barba", 2000), /servicio_repetido/);
      // El mismo nombre en otro barbero sí se puede.
      const delDueno = await crear(DUENO, DUENO, "Barba", 6000);
      for (const x of [s, otro]) await borrar(EMPLEADO, x.id);
      await borrar(DUENO, delDueno.id);
    });

    it("hasta 30 servicios por barbero", async () => {
      const ids: string[] = [];
      for (let i = 1; i <= 30; i++)
        ids.push((await crear(EMPLEADO, EMPLEADO, `Servicio ${i}`, 1000 + i)).id);
      await esperarError(crear(EMPLEADO, EMPLEADO, "Uno más", 1000), /demasiados_servicios/);
      for (const id of ids) await borrar(EMPLEADO, id);
    });

    it("el empleado no puede tocar los servicios del dueño", async () => {
      const s = await crear(DUENO, DUENO, "Corte premium", 12000);
      await esperarError(crear(EMPLEADO, DUENO, "Corte trucho", 1), /no_autorizado/);
      await esperarError(editar(EMPLEADO, s.id, "Corte premium", 1), /no_autorizado/);
      await esperarError(activar(EMPLEADO, s.id, false), /no_autorizado/);
      await esperarError(borrar(EMPLEADO, s.id), /no_autorizado/);
      const igual = await h.fila<Servicio>(`select * from servicios where id = $1`, [s.id]);
      expect(Number(igual.precio)).toBe(12000);
      expect(igual.activo).toBe(true);
      await borrar(DUENO, s.id);
    });

    it("el dueño y el admin manejan los del empleado; el admin no tiene servicios propios", async () => {
      const s = await crear(DUENO, EMPLEADO, "Degradé", 9000);
      expect(s.barbero_id).toBe(EMPLEADO);
      expect(Number((await editar(ADMIN, s.id, "Degradé", 9500)).precio)).toBe(9500);
      expect((await activar(DUENO, s.id, false)).activo).toBe(false);
      await borrar(ADMIN, s.id);
      await esperarError(crear(ADMIN, ADMIN, "Corte", 1000), /barbero_inexistente/);
    });

    it("un cliente o un visitante no pueden escribir servicios", async () => {
      const s = await crear(EMPLEADO, EMPLEADO, "Lavado", 1500);
      await esperarError(crear(JUAN, EMPLEADO, "Gratis", 1), /no_autorizado/);
      await esperarError(editar(JUAN, s.id, "Gratis", 1), /no_autorizado/);
      await esperarError(borrar(JUAN, s.id), /no_autorizado/);
      await h.conRol(como(JUAN), async () => {
        await esperarError(
          db.query(`insert into servicios (barbero_id, nombre, precio) values ($1, 'X', 1)`, [
            EMPLEADO,
          ]),
          SIN_PERMISO,
        );
        await esperarError(db.query(`update servicios set precio = 1`), SIN_PERMISO);
        await esperarError(db.query(`delete from servicios`), SIN_PERMISO);
      });
      // Ni el barbero escribe la tabla directo: todo pasa por las funciones.
      await h.conRol(como(EMPLEADO), () =>
        esperarError(db.query(`update servicios set precio = 1`), SIN_PERMISO),
      );
      await h.conRol(ANON, async () => {
        await esperarError(db.query(`select crear_servicio($1, 'X', 1)`, [EMPLEADO]), SIN_PERMISO);
        await esperarError(db.query(`select * from servicios`), SIN_PERMISO);
      });
      await borrar(EMPLEADO, s.id);
    });
  });

  // ─── Quién ve qué ─────────────────────────────────────────────────────────
  describe("lectura", () => {
    it("cada barbero carga sus servicios con sus precios", async () => {
      corteDueno = await crear(DUENO, DUENO, "Corte", 10000, "Con lavado");
      barbaDueno = await crear(DUENO, DUENO, "Corte + barba", 14000);
      corteEmpleado = await crear(EMPLEADO, EMPLEADO, "Corte", 8000);
      pausadoEmpleado = await crear(EMPLEADO, EMPLEADO, "Mechas", 25000);
      await activar(EMPLEADO, pausadoEmpleado.id, false);
    });

    it("el cliente ve los activos de cada barbero, no los pausados", async () => {
      const r = await visibles(como(JUAN));
      expect(r.map((s) => [s.barbero_id, s.nombre, Number(s.precio)])).toEqual([
        [DUENO, "Corte", 10000],
        [DUENO, "Corte + barba", 14000],
        [EMPLEADO, "Corte", 8000],
      ]);
    });

    it("el empleado ve sus pausados; el dueño, todos", async () => {
      const empleado = await visibles(como(EMPLEADO));
      expect(empleado.map((s) => s.nombre)).toContain("Mechas");
      await activar(DUENO, barbaDueno.id, false);
      expect((await visibles(como(EMPLEADO))).map((s) => s.id)).not.toContain(barbaDueno.id);
      expect(await visibles(como(DUENO))).toHaveLength(4);
      await activar(DUENO, barbaDueno.id, true);
    });
  });

  // ─── Reservar con servicio ────────────────────────────────────────────────
  describe("reservar_turno", () => {
    it("si el barbero ofrece servicios, hay que elegir uno", async () => {
      await esperarError(reservar(JUAN, DUENO, ar(MARTES, "10:00")), /servicio_requerido/);
    });

    it("rechaza un servicio de otro barbero, uno pausado o uno que no existe", async () => {
      await esperarError(
        reservar(JUAN, DUENO, ar(MARTES, "10:00"), corteEmpleado.id),
        /servicio_no_disponible/,
      );
      await esperarError(
        reservar(JUAN, EMPLEADO, ar(MARTES, "10:00"), pausadoEmpleado.id),
        /servicio_no_disponible/,
      );
      await esperarError(
        reservar(JUAN, EMPLEADO, ar(MARTES, "10:00"), "5e000000-0000-4000-8000-0000000000ff"),
        /servicio_no_disponible/,
      );
      // Ninguno de los intentos reservó nada.
      expect(await h.filas(`select 1 from turnos where cliente_id = $1`, [JUAN])).toEqual([]);
    });

    it("guarda una copia del servicio y la muestra al cliente y en la agenda", async () => {
      const t = await reservar(JUAN, DUENO, ar(MARTES, "10:00"), barbaDueno.id);
      expect(t.servicio_id).toBe(barbaDueno.id);
      expect(t.servicio_nombre).toBe("Corte + barba");
      expect(Number(t.servicio_precio)).toBe(14000);

      const mio = await h.conRol(como(JUAN), () =>
        h.fila<{ servicio_nombre: string; servicio_precio: string }>(
          `select * from mi_proximo_turno()`,
        ),
      );
      expect(mio.servicio_nombre).toBe("Corte + barba");
      expect(Number(mio.servicio_precio)).toBe(14000);

      const agenda = await h.conRol(como(DUENO), () =>
        h.filas<{
          turno_id: string;
          servicio_nombre: string | null;
          servicio_precio: string | null;
        }>(`select * from agenda_dia($1, $2) where tipo = 'reserva'`, [DUENO, MARTES]),
      );
      const fila = agenda.find((f) => f.turno_id === t.id);
      expect(fila?.servicio_nombre).toBe("Corte + barba");
      expect(Number(fila?.servicio_precio)).toBe(14000);
    });

    it("la copia no cambia si después cambia el precio, se pausa o se borra el servicio", async () => {
      await editar(DUENO, barbaDueno.id, "Corte y barba", 16000);
      await activar(DUENO, barbaDueno.id, false);
      const mio = await h.conRol(como(JUAN), () =>
        h.fila<{ servicio_nombre: string; servicio_precio: string }>(
          `select * from mi_proximo_turno()`,
        ),
      );
      expect(mio.servicio_nombre).toBe("Corte + barba");
      expect(Number(mio.servicio_precio)).toBe(14000);

      await borrar(DUENO, barbaDueno.id);
      const t = await h.fila<TurnoRow>(`select * from turnos where cliente_id = $1`, [JUAN]);
      expect(t.servicio_id).toBeNull();
      expect(t.servicio_nombre).toBe("Corte + barba");
      expect(Number(t.servicio_precio)).toBe(14000);
    });

    it("cada barbero cobra su precio por el mismo servicio", async () => {
      const conDueno = await reservar(MARTIN, DUENO, ar(MARTES, "11:00"), corteDueno.id);
      const conEmpleado = await reservar(LUCAS, EMPLEADO, ar(MARTES, "11:00"), corteEmpleado.id);
      expect([conDueno.servicio_nombre, Number(conDueno.servicio_precio)]).toEqual([
        "Corte",
        10000,
      ]);
      expect([conEmpleado.servicio_nombre, Number(conEmpleado.servicio_precio)]).toEqual([
        "Corte",
        8000,
      ]);
      // El empleado ve su agenda con el servicio, pero no la del dueño.
      await h.conRol(como(EMPLEADO), () =>
        esperarError(
          db.query(`select * from agenda_dia($1, $2)`, [DUENO, MARTES]),
          /no_autorizado/,
        ),
      );
    });

    it("un barbero sin servicios activos reserva como siempre (sin servicio)", async () => {
      // El empleado pausa todos los suyos: deja de pedir servicio.
      await activar(EMPLEADO, corteEmpleado.id, false);
      const t = await reservar(SANTIAGO, EMPLEADO, ar(MIERCOLES, "10:00"));
      expect(t.servicio_id).toBeNull();
      expect(t.servicio_nombre).toBeNull();
      expect(t.servicio_precio).toBeNull();
      // Pero no acepta uno pausado.
      await cancelar(SANTIAGO, t.id);
      await esperarError(
        reservar(SANTIAGO, EMPLEADO, ar(MIERCOLES, "10:30"), corteEmpleado.id),
        /servicio_no_disponible/,
      );
      await activar(EMPLEADO, corteEmpleado.id, true);
    });

    it("sigue respetando las reglas de antes (cambio de contraseña pendiente, 1 turno activo)", async () => {
      await esperarError(
        reservar(JUAN, DUENO, ar(MIERCOLES, "10:00"), corteDueno.id),
        /turno_activo/,
      );
      await db.query(`update perfiles set debe_cambiar_password = true where id = $1`, [FACUNDO]);
      await esperarError(
        reservar(FACUNDO, DUENO, ar(MIERCOLES, "10:00"), corteDueno.id),
        /cambio_password_pendiente/,
      );
      await db.query(`update perfiles set debe_cambiar_password = false where id = $1`, [FACUNDO]);
    });

    it("es idempotente por solicitud (devuelve el mismo turno, con su servicio)", async () => {
      const solicitud = "5e000000-0000-4000-8000-0000000000bb";
      const llamar = () =>
        h.conRol(como(FACUNDO), () =>
          h.fila<TurnoRow>(`select * from reservar_turno($1, $2, $3, $4)`, [
            DUENO,
            ar(MIERCOLES, "12:00"),
            solicitud,
            corteDueno.id,
          ]),
        );
      const a = await llamar();
      const b = await llamar();
      expect(b.id).toBe(a.id);
      expect(b.servicio_nombre).toBe("Corte");
    });
  });

  describe("permisos", () => {
    it("ninguna función nueva queda ejecutable por PUBLIC ni por anon", async () => {
      const r = await h.filas<{ f: string; anon: boolean; publico: boolean }>(`
        select p.oid::regprocedure::text as f,
               has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
               coalesce((select bool_or(a.grantee = 0)
                         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a), false) as publico
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in ('_datos_servicio', '_servicio_para_editar', 'crear_servicio',
            'editar_servicio', 'activar_servicio', 'borrar_servicio', 'reservar_turno',
            'mi_proximo_turno', 'agenda_dia')`);
      expect(r).toHaveLength(9);
      expect(r.filter((x) => x.publico || x.anon)).toEqual([]);
    });

    it("los helpers internos no los puede llamar un usuario", async () => {
      await h.conRol(como(DUENO), async () => {
        await esperarError(
          db.query(`select * from _datos_servicio('Corte', 1, null)`),
          SIN_PERMISO,
        );
        await esperarError(
          db.query(`select * from _servicio_para_editar($1)`, [corteDueno.id]),
          SIN_PERMISO,
        );
      });
    });
  });
});
