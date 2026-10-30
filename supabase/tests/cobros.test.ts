/**
 * Tests de la base para COBROS (migración 20261030000100_cobros.sql).
 *
 *   · Cada corte guarda el medio de pago (efectivo o transferencia).
 *   · Servicios sin cliente registrado: quién los carga, quién los ve y quién
 *     los deshace (las mismas reglas que los cortes).
 *   · facturacion() los suma y separa por medio de pago; movimientos_caja()
 *     lista todo para la caja y el informe del contador. Solo el dueño.
 *
 * Igual que los demás: PGlite con stubs de Supabase y cada rol simulado con
 * `set role` + `request.jwt.claims`.
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
const MIGRACION = "20261030000100_cobros.sql";

const DUENO = "b0000000-0000-4000-8000-000000000001";
const EMPLEADO = "b0000000-0000-4000-8000-000000000002";
const ADMIN = "b0000000-0000-4000-8000-000000000003";
const JUAN = "c0000000-0000-4000-8000-000000000001";
const MARTIN = "c0000000-0000-4000-8000-000000000002";
const LUCAS = "c0000000-0000-4000-8000-000000000003";
const SANTIAGO = "c0000000-0000-4000-8000-000000000004";
const FACUNDO = "c0000000-0000-4000-8000-000000000005";
const NICOLAS = "c0000000-0000-4000-8000-000000000006";

type Rol = { rol: "anon" } | { rol: "authenticated"; sub: string };
const ANON: Rol = { rol: "anon" };
const como = (sub: string): Rol => ({ rol: "authenticated", sub });
const SIN_PERMISO = /permission denied/;

type Corte = { id: string; monto: string | null; medio_pago: string | null };
type Hecho = {
  id: string;
  barbero_id: string | null;
  servicio_id: string | null;
  servicio_nombre: string;
  monto: string;
  medio_pago: string;
  nota: string | null;
  registrado_por: string | null;
};
type FilaCaja = {
  barbero_id: string | null;
  cortes: number;
  cortes_sin_monto: number;
  total: string;
  servicios: number;
  efectivo: string;
  transferencia: string;
};
type Movimiento = {
  tipo: string;
  id: string;
  barbero_id: string | null;
  barbero_nombre: string | null;
  cliente_nombre: string | null;
  servicio_nombre: string | null;
  monto: string | null;
  medio_pago: string | null;
};

async function nuevaBase({ hasta }: { hasta?: string } = {}) {
  const base = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
  await base.exec(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
  for (const archivo of readdirSync(join(RAIZ, "migrations")).sort()) {
    if (hasta && archivo >= hasta) continue;
    await base.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  await base.exec(readFileSync(join(RAIZ, "seed.sql"), "utf8"));
  // Sin cortes de hoy: así la caja de hoy arranca vacía.
  await base.exec(`delete from public.cortes where fecha >= current_date - 1;`);
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
  it("los cortes que había quedan sin medio de pago y la app vieja sigue cargando igual", async () => {
    const base = await nuevaBase({ hasta: MIGRACION });
    const h = herramientas(base);
    try {
      const antes = await h.fila<{ n: number }>(`select count(*)::int as n from cortes`);
      await base.exec(readFileSync(join(RAIZ, "migrations", MIGRACION), "utf8"));

      const despues = await h.fila<{ n: number; sin_medio: number }>(
        `select count(*)::int as n, (count(*) filter (where medio_pago is null))::int as sin_medio from cortes`,
      );
      expect(despues).toEqual({ n: antes.n, sin_medio: antes.n });

      // Como la llama la app publicada (por nombre, sin p_medio_pago).
      const c = await h.conRol(como(EMPLEADO), () =>
        h.fila<Corte>(
          `select * from registrar_corte(p_cliente_id => $1, p_solicitud_id => $2, p_monto => $3)`,
          [JUAN, "5e000000-0000-4000-8000-0000000000aa", 8000],
        ),
      );
      expect(c.medio_pago).toBeNull();

      // Queda una sola versión (si no, PostgREST no sabría cuál llamar).
      const versiones = await h.filas(
        `select 1 from pg_proc where proname = 'registrar_corte' and pronamespace = 'public'::regnamespace`,
      );
      expect(versiones).toHaveLength(1);

      // facturacion suma columnas al final: la app publicada la sigue leyendo igual.
      const caja = await h.conRol(como(DUENO), () =>
        h.filas<FilaCaja>(
          `select * from facturacion(p_desde => current_date - 30, p_hasta => current_date)`,
        ),
      );
      expect(caja.length).toBeGreaterThan(0);
    } finally {
      await base.close();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("con la migración aplicada", () => {
  let db: PGlite;
  let h: ReturnType<typeof herramientas>;

  const cortar = (quien: string, cliente: string, monto: number | null, medio: string | null) =>
    h.conRol(como(quien), () =>
      h.fila<Corte>(`select * from registrar_corte($1, null, $2, $3)`, [cliente, monto, medio]),
    );
  const registrar = (
    quien: string,
    datos: {
      barbero: string;
      monto: number | null;
      medio: string | null;
      servicio?: string | null;
      nombre?: string | null;
      nota?: string | null;
      solicitud?: string | null;
    },
  ) =>
    h.conRol(como(quien), () =>
      h.fila<Hecho>(`select * from registrar_servicio_hecho($1, $2, $3, $4, $5, $6, $7)`, [
        datos.barbero,
        datos.monto,
        datos.medio,
        datos.servicio ?? null,
        datos.nombre ?? null,
        datos.nota ?? null,
        datos.solicitud ?? null,
      ]),
    );
  const deshacer = (quien: string, id: string) =>
    h.conRol(como(quien), () => db.query(`select deshacer_servicio_hecho($1)`, [id]));
  const visibles = (rol: Rol) =>
    h.conRol(rol, () => h.filas<Hecho>(`select * from servicios_hechos order by fecha`));
  const cajaDeHoy = () =>
    h.conRol(como(DUENO), () =>
      h.filas<FilaCaja>(`select * from facturacion(current_date, current_date)`),
    );

  let barbaEmpleado: string;
  let corteDueno: string;

  beforeAll(async () => {
    db = await nuevaBase();
    h = herramientas(db);
    barbaEmpleado = (
      await h.conRol(como(EMPLEADO), () =>
        h.fila<{ id: string }>(`select * from crear_servicio($1, 'Barba', 6000)`, [EMPLEADO]),
      )
    ).id;
    corteDueno = (
      await h.conRol(como(DUENO), () =>
        h.fila<{ id: string }>(`select * from crear_servicio($1, 'Corte', 9000)`, [DUENO]),
      )
    ).id;
  });
  afterAll(async () => db?.close());

  // ─── Cortes ───────────────────────────────────────────────────────────────
  describe("registrar_corte con medio de pago", () => {
    it("guarda efectivo o transferencia", async () => {
      expect((await cortar(EMPLEADO, JUAN, 8000, "efectivo")).medio_pago).toBe("efectivo");
      expect((await cortar(DUENO, MARTIN, 9000, "transferencia")).medio_pago).toBe("transferencia");
    });

    it("sin cobro (sin monto o $ 0) no guarda medio de pago", async () => {
      expect((await cortar(EMPLEADO, LUCAS, null, "efectivo")).medio_pago).toBeNull();
      expect((await cortar(EMPLEADO, SANTIAGO, 0, "transferencia")).medio_pago).toBeNull();
    });

    it("rechaza un medio de pago que no existe", async () => {
      await esperarError(cortar(EMPLEADO, FACUNDO, 8000, "tarjeta"), /medio_pago_invalido/);
    });
  });

  // ─── Servicios sin cliente ────────────────────────────────────────────────
  describe("registrar_servicio_hecho", () => {
    it("el empleado carga los suyos, de su lista (copia el nombre) o escrito a mano", async () => {
      const deLista = await registrar(EMPLEADO, {
        barbero: EMPLEADO,
        monto: 6000,
        medio: "efectivo",
        servicio: barbaEmpleado,
        nota: "  Pedro,   de paso ",
      });
      expect(deLista).toMatchObject({
        barbero_id: EMPLEADO,
        servicio_id: barbaEmpleado,
        servicio_nombre: "Barba",
        monto: "6000.00",
        medio_pago: "efectivo",
        nota: "Pedro, de paso",
        registrado_por: EMPLEADO,
      });

      const aMano = await registrar(EMPLEADO, {
        barbero: EMPLEADO,
        monto: 4500.5,
        medio: "transferencia",
        nombre: "  Perfilado   de cejas ",
      });
      expect(aMano).toMatchObject({
        servicio_id: null,
        servicio_nombre: "Perfilado de cejas",
        monto: "4500.50",
        nota: null,
      });
    });

    it("el dueño lo carga por cualquier barbero; el empleado, no por otro", async () => {
      const r = await registrar(DUENO, {
        barbero: EMPLEADO,
        monto: 7000,
        medio: "efectivo",
        nombre: "Corte",
      });
      expect(r).toMatchObject({ barbero_id: EMPLEADO, registrado_por: DUENO });
      await esperarError(
        registrar(EMPLEADO, { barbero: DUENO, monto: 7000, medio: "efectivo", nombre: "Corte" }),
        /no_autorizado/,
      );
    });

    it("el admin no atiende: no se le cargan servicios", async () => {
      await esperarError(
        registrar(ADMIN, { barbero: ADMIN, monto: 7000, medio: "efectivo", nombre: "Corte" }),
        /barbero_inexistente/,
      );
    });

    it("un cliente o un visitante no pueden cargar", async () => {
      await esperarError(
        registrar(JUAN, { barbero: EMPLEADO, monto: 7000, medio: "efectivo", nombre: "Corte" }),
        /no_autorizado/,
      );
      await h.conRol(ANON, () =>
        esperarError(
          db.query(`select registrar_servicio_hecho($1, 7000, 'efectivo', null, 'Corte')`, [
            EMPLEADO,
          ]),
          SIN_PERMISO,
        ),
      );
    });

    it("valida monto, medio de pago, nombre, aclaración y servicio", async () => {
      const base = { barbero: EMPLEADO, monto: 5000, medio: "efectivo", nombre: "Corte" };
      for (const monto of [null, 0, -1, 10_000_000]) {
        await esperarError(registrar(EMPLEADO, { ...base, monto }), /monto_invalido/);
      }
      await esperarError(registrar(EMPLEADO, { ...base, medio: null }), /medio_pago_invalido/);
      await esperarError(registrar(EMPLEADO, { ...base, medio: "tarjeta" }), /medio_pago_invalido/);
      await esperarError(
        registrar(EMPLEADO, { ...base, nombre: " x " }),
        /servicio_nombre_invalido/,
      );
      await esperarError(
        registrar(EMPLEADO, { ...base, nombre: null }),
        /servicio_nombre_invalido/,
      );
      await esperarError(registrar(EMPLEADO, { ...base, nota: "a".repeat(81) }), /nota_invalida/);
      // Un servicio de otro barbero.
      await esperarError(
        registrar(EMPLEADO, { ...base, servicio: corteDueno }),
        /servicio_inexistente/,
      );
    });

    it("es idempotente por solicitud", async () => {
      const solicitud = "5e000000-0000-4000-8000-0000000000bb";
      const datos = {
        barbero: EMPLEADO,
        monto: 3000,
        medio: "efectivo",
        nombre: "Lavado",
        solicitud,
      };
      const a = await registrar(EMPLEADO, datos);
      const b = await registrar(EMPLEADO, datos);
      expect(b.id).toBe(a.id);
      const n = await h.fila<{ n: number }>(
        `select count(*)::int as n from servicios_hechos where solicitud_id = $1`,
        [solicitud],
      );
      expect(n.n).toBe(1);
      // Otro barbero no puede reusar la clave.
      await esperarError(registrar(DUENO, { ...datos, barbero: DUENO }), /solicitud_invalida/);
    });
  });

  // ─── Lectura ──────────────────────────────────────────────────────────────
  describe("quién ve qué", () => {
    it("el dueño ve todos; el empleado, los suyos; el cliente, ninguno", async () => {
      const propio = await registrar(DUENO, {
        barbero: DUENO,
        monto: 9000,
        medio: "transferencia",
        servicio: corteDueno,
      });
      const delDueno = await visibles(como(DUENO));
      const delEmpleado = await visibles(como(EMPLEADO));
      expect(delDueno.map((x) => x.id)).toContain(propio.id);
      expect(delEmpleado.map((x) => x.id)).not.toContain(propio.id);
      expect(delEmpleado.length).toBeGreaterThan(0);
      expect(delEmpleado.every((x) => x.barbero_id === EMPLEADO)).toBe(true);
      expect(await visibles(como(JUAN))).toEqual([]);
      await h.conRol(ANON, () =>
        esperarError(db.query(`select * from servicios_hechos`), SIN_PERMISO),
      );
    });

    it("nadie escribe la tabla directamente", async () => {
      await h.conRol(como(DUENO), () =>
        esperarError(
          db.query(
            `insert into servicios_hechos (barbero_id, servicio_nombre, monto, medio_pago)
             values ($1, 'Corte', 1, 'efectivo')`,
            [DUENO],
          ),
          SIN_PERMISO,
        ),
      );
    });
  });

  // ─── Deshacer ─────────────────────────────────────────────────────────────
  describe("deshacer_servicio_hecho", () => {
    it("el empleado deshace los suyos dentro de los 10 minutos; no los que cargó otro", async () => {
      const mio = await registrar(EMPLEADO, {
        barbero: EMPLEADO,
        monto: 1000,
        medio: "efectivo",
        nombre: "Corte",
      });
      const porElDueno = await registrar(DUENO, {
        barbero: EMPLEADO,
        monto: 1000,
        medio: "efectivo",
        nombre: "Corte",
      });
      await esperarError(deshacer(EMPLEADO, porElDueno.id), /servicio_hecho_ajeno/);
      await deshacer(EMPLEADO, mio.id);
      await esperarError(deshacer(EMPLEADO, mio.id), /servicio_hecho_inexistente/);

      const viejo = await registrar(EMPLEADO, {
        barbero: EMPLEADO,
        monto: 1000,
        medio: "efectivo",
        nombre: "Corte",
      });
      await db.query(
        `update servicios_hechos set fecha = now() - interval '11 minutes' where id = $1`,
        [viejo.id],
      );
      await esperarError(deshacer(EMPLEADO, viejo.id), /servicio_fuera_de_plazo/);
    });

    it("el dueño deshace cualquiera del día, no de días anteriores", async () => {
      const a = await registrar(EMPLEADO, {
        barbero: EMPLEADO,
        monto: 1000,
        medio: "efectivo",
        nombre: "Corte",
      });
      const b = await registrar(EMPLEADO, {
        barbero: EMPLEADO,
        monto: 1000,
        medio: "efectivo",
        nombre: "Corte",
      });
      await db.query(
        `update servicios_hechos set fecha = now() - interval '2 days' where id = $1`,
        [b.id],
      );
      await deshacer(DUENO, a.id);
      await esperarError(deshacer(DUENO, b.id), /servicio_fuera_de_plazo/);
      await db.query(`delete from servicios_hechos where id = $1`, [b.id]);
    });
  });

  // ─── Caja ─────────────────────────────────────────────────────────────────
  describe("facturacion y movimientos_caja", () => {
    it("la caja suma cortes y servicios sin cliente, y separa por medio de pago", async () => {
      await db.exec(`delete from cortes; delete from servicios_hechos;`);
      await cortar(EMPLEADO, JUAN, 8000, "efectivo");
      await cortar(EMPLEADO, MARTIN, 9000.5, "transferencia");
      await cortar(EMPLEADO, LUCAS, null, null);
      await registrar(EMPLEADO, {
        barbero: EMPLEADO,
        monto: 6000,
        medio: "transferencia",
        servicio: barbaEmpleado,
      });
      await registrar(DUENO, {
        barbero: DUENO,
        monto: 9000,
        medio: "efectivo",
        servicio: corteDueno,
      });
      // Un corte viejo, sin medio de pago.
      await db.query(
        `insert into cortes (cliente_id, registrado_por, monto, fecha) values ($1, $2, 5000, now())`,
        [NICOLAS, DUENO],
      );

      const caja = await cajaDeHoy();
      const empleado = caja.find((f) => f.barbero_id === EMPLEADO)!;
      const dueno = caja.find((f) => f.barbero_id === DUENO)!;
      expect(empleado).toMatchObject({
        cortes: 3,
        cortes_sin_monto: 1,
        servicios: 1,
        total: "23000.50",
        efectivo: "8000.00",
        transferencia: "15000.50",
      });
      expect(dueno).toMatchObject({
        cortes: 1,
        servicios: 1,
        total: "14000.00",
        efectivo: "9000.00",
        transferencia: "0",
      });
      // El admin no cargó nada: no aparece.
      expect(caja.some((f) => f.barbero_id === ADMIN)).toBe(false);
    });

    it("movimientos_caja lista todo, con el servicio del turno en los cortes", async () => {
      // El corte de Juan atendió un turno con servicio.
      await db.query(
        `insert into turnos (barbero_id, cliente_id, inicio, fin, estado, corte_id, servicio_nombre, servicio_precio)
         select $1, $2, now() + interval '30 days', now() + interval '30 days 30 minutes', 'atendido', id,
                'Corte + barba', 8000
         from cortes where cliente_id = $2`,
        [EMPLEADO, JUAN],
      );
      const m = await h.conRol(como(DUENO), () =>
        h.filas<Movimiento>(`select * from movimientos_caja(current_date, current_date)`),
      );
      expect(m).toHaveLength(6);
      expect(m.filter((x) => x.tipo === "servicio")).toHaveLength(2);
      expect(m.find((x) => x.cliente_nombre === "Juan Pérez")).toMatchObject({
        tipo: "corte",
        barbero_nombre: "Nahuel Castro",
        servicio_nombre: "Corte + barba",
        monto: "8000.00",
        medio_pago: "efectivo",
      });
      expect(m.find((x) => x.servicio_nombre === "Barba")).toMatchObject({
        tipo: "servicio",
        barbero_id: EMPLEADO,
        medio_pago: "transferencia",
      });
    });

    it("solo el dueño (y el admin) ve la caja; valida el período", async () => {
      for (const f of ["facturacion", "movimientos_caja"]) {
        await h.conRol(como(EMPLEADO), () =>
          esperarError(db.query(`select * from ${f}(current_date, current_date)`), /no_autorizado/),
        );
        await h.conRol(como(JUAN), () =>
          esperarError(db.query(`select * from ${f}(current_date, current_date)`), /no_autorizado/),
        );
        await h.conRol(como(DUENO), () =>
          esperarError(
            db.query(`select * from ${f}(current_date, current_date - 1)`),
            /periodo_invalido/,
          ),
        );
      }
      const delAdmin = await h.conRol(como(ADMIN), () =>
        h.filas(`select * from movimientos_caja(current_date, current_date)`),
      );
      expect(delAdmin).toHaveLength(6);
    });
  });

  // ─── Permisos ─────────────────────────────────────────────────────────────
  describe("permisos", () => {
    it("ninguna función nueva queda ejecutable por PUBLIC ni por anon", async () => {
      const r = await h.filas<{ f: string; anon: boolean; publico: boolean }>(`
        select p.oid::regprocedure::text as f,
               has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
               coalesce((select bool_or(a.grantee = 0)
                         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a), false) as publico
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in ('_validar_medio_pago', 'registrar_corte', 'registrar_servicio_hecho',
            'deshacer_servicio_hecho', 'facturacion', 'movimientos_caja')`);
      expect(r).toHaveLength(6);
      expect(r.filter((x) => x.publico || x.anon)).toEqual([]);
    });

    it("el helper interno no lo puede llamar un usuario", async () => {
      await h.conRol(como(DUENO), () =>
        esperarError(db.query(`select _validar_medio_pago('efectivo')`), SIN_PERMISO),
      );
    });
  });
});
