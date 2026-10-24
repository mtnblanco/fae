/**
 * Tests de la base: migraciones, seed, RLS y funciones atómicas.
 *
 * Corre en PGlite (Postgres embebido, sin Docker) con stubs mínimos de Supabase.
 * Simula cada rol de PostgREST igual que Supabase: `set role` + `request.jwt.claims`.
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

const BARBERO = "b0000000-0000-4000-8000-000000000001"; // dueño
const EMPLEADO = "b0000000-0000-4000-8000-000000000002";
// El seed tiene la regla de etapas "4: 20% off · 7: 50% off · 10: Corte gratis" y
// canjes hechos con la regla anterior ("cada 5 cortes", etapa 5).
const JUAN = "c0000000-0000-4000-8000-000000000001"; // 4 cortes, 0 canjes → 20% off
const MARTIN = "c0000000-0000-4000-8000-000000000002"; // 5 cortes → 20% off
const LUCAS = "c0000000-0000-4000-8000-000000000003"; // 12 cortes, 2 canjes → corte gratis
const SANTIAGO = "c0000000-0000-4000-8000-000000000004"; // 3 cortes
const FACUNDO = "c0000000-0000-4000-8000-000000000005"; // 10 cortes, los últimos del empleado
const NICOLAS = "c0000000-0000-4000-8000-000000000006"; // 1 corte
const TOMAS = "c0000000-0000-4000-8000-000000000007"; // 7 cortes, 1 canje
const AGUSTIN = "c0000000-0000-4000-8000-000000000008"; // 0 cortes, sin precio
const EZEQUIEL = "c0000000-0000-4000-8000-000000000010"; // 2 cortes
const JOAQUIN = "c0000000-0000-4000-8000-000000000012"; // 15 cortes, 2 canjes
const SIN_PERFIL = "d0000000-0000-4000-8000-000000000001";

const ETAPAS_SEED = [
  { corte: 4, descripcion: "20% off" },
  { corte: 7, descripcion: "50% off" },
  { corte: 10, descripcion: "Corte gratis" },
];

type Rol = { rol: "anon" } | { rol: "authenticated"; sub: string };
const ANON: Rol = { rol: "anon" };
const como = (sub: string): Rol => ({ rol: "authenticated", sub });

let db: PGlite;

async function superusuario() {
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
}

/** Ejecuta `fn` con los permisos de un rol de Supabase (como lo haría PostgREST). */
async function conRol<T>(rol: Rol, fn: () => Promise<T>): Promise<T> {
  const claims = rol.rol === "anon" ? { role: "anon" } : { role: "authenticated", sub: rol.sub };
  await db.exec(
    `reset role; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false); set role ${rol.rol};`,
  );
  try {
    return await fn();
  } finally {
    await superusuario();
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

async function contar(sql: string, params: unknown[] = []) {
  const r = await fila<{ n: number }>(`select count(*)::int as n from (${sql}) t`, params);
  return r.n;
}

async function esperarError(promesa: Promise<unknown>, patron: RegExp) {
  await expect(promesa).rejects.toThrow(patron);
}

const SIN_PERMISO = /permission denied/;

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
  await db.exec(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
  for (const archivo of readdirSync(join(RAIZ, "migrations")).sort()) {
    await db.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  await db.exec(readFileSync(join(RAIZ, "seed.sql"), "utf8"));
  // Un usuario de Auth sin perfil (por ejemplo, alguien que se registró por su cuenta).
  await db.exec(
    `insert into auth.users (id, email) values ('${SIN_PERFIL}', 'intruso@ejemplo.com')`,
  );
});

afterAll(async () => {
  await db?.close();
});

// ════════════════════════════════════════════════════════════════════════════
describe("estructura y hardening", () => {
  it("todas las tablas de public tienen RLS activado", async () => {
    const sinRls = await filas<{ relname: string }>(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(sinRls).toEqual([]);
  });

  it("todas las funciones security definer fijan search_path", async () => {
    const inseguras = await filas<{ proname: string }>(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(inseguras).toEqual([]);
  });

  it("service_role puede administrar perfiles aunque no haya permisos automáticos", async () => {
    const r = await fila<{ insertar: boolean; editar: boolean }>(
      `select has_table_privilege('service_role', 'public.perfiles', 'INSERT') as insertar,
              has_table_privilege('service_role', 'public.perfiles', 'UPDATE') as editar`,
    );
    expect(r).toEqual({ insertar: true, editar: true });
  });

  it("la vista resumen_clientes es security_invoker", async () => {
    const r = await fila<{ opciones: string[] }>(
      `select reloptions as opciones from pg_class where relname = 'resumen_clientes'`,
    );
    expect(r.opciones).toContain("security_invoker=true");
  });

  it("cortes, canjes y turnos están publicados en Realtime", async () => {
    const tablas = await filas<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`,
    );
    expect(tablas.map((t) => t.tablename)).toEqual(["canjes", "cortes", "turnos"]);
  });

  it("solo puede haber una regla activa", async () => {
    await esperarError(
      db.query(
        `insert into reglas (cortes_necesarios, descripcion_premio, activa) values (3, 'Corte gratis', true)`,
      ),
      /duplicate key|reglas_una_activa_idx/,
    );
  });

  it("valida formato de teléfono y que el cliente tenga teléfono", async () => {
    await db.exec(
      `insert into auth.users (id, email) values ('e0000000-0000-4000-8000-000000000001', 'x@x.com')`,
    );
    await esperarError(
      db.query(
        `insert into perfiles (id, nombre, telefono) values ('e0000000-0000-4000-8000-000000000001', 'Test', '11-2233')`,
      ),
      /perfiles_telefono_formato/,
    );
    await esperarError(
      db.query(
        `insert into perfiles (id, nombre, telefono, rol) values ('e0000000-0000-4000-8000-000000000001', 'Test', null, 'cliente')`,
      ),
      /perfiles_cliente_con_telefono/,
    );
    await db.exec(`delete from auth.users where id = 'e0000000-0000-4000-8000-000000000001'`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("anon (sin login)", () => {
  it("no puede leer datos de clientes", async () => {
    await conRol(ANON, async () => {
      for (const tabla of [
        "perfiles",
        "cortes",
        "canjes",
        "descuentos_asociados",
        "resumen_clientes",
      ]) {
        await esperarError(db.query(`select * from ${tabla}`), SIN_PERMISO);
      }
    });
  });

  it("solo ve la regla activa", async () => {
    const reglas = await conRol(ANON, () => filas<{ activa: boolean }>(`select * from reglas`));
    expect(reglas).toHaveLength(1);
    expect(reglas[0]?.activa).toBe(true);
  });

  it("no puede ejecutar funciones del panel", async () => {
    await conRol(ANON, async () => {
      await esperarError(db.query(`select registrar_corte($1)`, [JUAN]), SIN_PERMISO);
      await esperarError(db.query(`select canjear_premio($1)`, [MARTIN]), SIN_PERMISO);
      await esperarError(db.query(`select * from metricas_panel()`), SIN_PERMISO);
      await esperarError(db.query(`select es_barbero()`), SIN_PERMISO);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("cliente: lectura", () => {
  it("solo ve su propio perfil, aunque pida el de otro", async () => {
    await conRol(como(JUAN), async () => {
      const perfiles = await filas<{ id: string }>(`select id from perfiles`);
      expect(perfiles.map((p) => p.id)).toEqual([JUAN]);
      expect(await contar(`select * from perfiles where id = $1`, [MARTIN])).toBe(0);
      expect(await contar(`select * from perfiles where rol = 'barbero'`)).toBe(0);
    });
  });

  it("solo ve sus propios cortes y canjes", async () => {
    await conRol(como(LUCAS), async () => {
      expect(await contar(`select * from cortes`)).toBe(12);
      expect(await contar(`select * from cortes where cliente_id <> $1`, [LUCAS])).toBe(0);
      expect(await contar(`select * from cortes where cliente_id = $1`, [JOAQUIN])).toBe(0);
      expect(await contar(`select * from canjes`)).toBe(2);
      expect(await contar(`select * from canjes where cliente_id = $1`, [JOAQUIN])).toBe(0);
    });
  });

  it("en resumen_clientes solo ve su fila", async () => {
    await conRol(como(JUAN), async () => {
      const r = await filas<{ id: string }>(`select id from resumen_clientes`);
      expect(r.map((x) => x.id)).toEqual([JUAN]);
      expect(await contar(`select * from resumen_clientes where id = $1`, [MARTIN])).toBe(0);
    });
  });

  it("solo ve la regla activa y los descuentos activos y vigentes", async () => {
    await conRol(como(JUAN), async () => {
      expect(await contar(`select * from reglas`)).toBe(1);
      const d = await filas<{ comercio: string }>(
        `select comercio from descuentos_asociados order by comercio`,
      );
      expect(d.map((x) => x.comercio)).toEqual([
        "Café del Centro",
        "Gimnasio Olimpo",
        "Indumentaria Raíces",
        "Lavadero El Torito",
      ]);
    });
  });

  it("un usuario de Auth sin perfil no ve nada", async () => {
    await conRol(como(SIN_PERFIL), async () => {
      expect(await contar(`select * from perfiles`)).toBe(0);
      expect(await contar(`select * from cortes`)).toBe(0);
      expect(await contar(`select * from canjes`)).toBe(0);
      expect(await contar(`select * from resumen_clientes`)).toBe(0);
      await esperarError(db.query(`select registrar_corte($1)`, [SIN_PERFIL]), /no_autorizado/);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("cliente: escritura (todo prohibido)", () => {
  it("no puede modificar su rol ni el flag de contraseña", async () => {
    await conRol(como(JUAN), async () => {
      await esperarError(
        db.query(`update perfiles set rol = 'barbero' where id = $1`, [JUAN]),
        SIN_PERMISO,
      );
      await esperarError(
        db.query(`update perfiles set debe_cambiar_password = false where id = $1`, [JUAN]),
        SIN_PERMISO,
      );
      await esperarError(
        db.query(`update perfiles set nombre = 'Hacker' where id = $1`, [JUAN]),
        SIN_PERMISO,
      );
    });
    const juan = await fila<{ rol: string; nombre: string }>(
      `select rol, nombre from perfiles where id = $1`,
      [JUAN],
    );
    expect(juan).toEqual({ rol: "cliente", nombre: "Juan Pérez" });
  });

  it("no puede crear ni borrar perfiles", async () => {
    await conRol(como(JUAN), async () => {
      await esperarError(
        db.query(`insert into perfiles (id, nombre, telefono) values ($1, 'X', '2346000000')`, [
          SIN_PERFIL,
        ]),
        SIN_PERMISO,
      );
      await esperarError(db.query(`delete from perfiles where id = $1`, [JUAN]), SIN_PERMISO);
    });
  });

  it("no puede sumarse cortes ni borrarlos, ni directo ni por función", async () => {
    await conRol(como(JUAN), async () => {
      await esperarError(
        db.query(`insert into cortes (cliente_id) values ($1)`, [JUAN]),
        SIN_PERMISO,
      );
      await esperarError(db.query(`delete from cortes where cliente_id = $1`, [JUAN]), SIN_PERMISO);
      await esperarError(
        db.query(`update cortes set fecha = now() where cliente_id = $1`, [JUAN]),
        SIN_PERMISO,
      );
      await esperarError(db.query(`select registrar_corte($1)`, [JUAN]), /no_autorizado/);
    });
    const ultimo = await fila<{ id: string }>(
      `select id from cortes where cliente_id = $1 order by fecha desc limit 1`,
      [JUAN],
    );
    await conRol(como(JUAN), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [ultimo.id]), /no_autorizado/),
    );
    expect(await contar(`select * from cortes where cliente_id = $1`, [JUAN])).toBe(4);
  });

  it("no puede canjear premios ni insertar canjes", async () => {
    await conRol(como(MARTIN), async () => {
      await esperarError(
        db.query(`insert into canjes (cliente_id, premio_descripcion) values ($1, 'Gratis')`, [
          MARTIN,
        ]),
        SIN_PERMISO,
      );
      await esperarError(db.query(`select canjear_premio($1)`, [MARTIN]), /no_autorizado/);
    });
    expect(await contar(`select * from canjes where cliente_id = $1`, [MARTIN])).toBe(0);
  });

  it("no puede tocar reglas, descuentos ni ver métricas", async () => {
    await conRol(como(JUAN), async () => {
      await esperarError(db.query(`select guardar_regla(1, 'Todo gratis')`), /no_autorizado/);
      await esperarError(db.query(`update reglas set cortes_necesarios = 1`), SIN_PERMISO);
      await esperarError(db.query(`select * from metricas_panel()`), /no_autorizado/);
      await esperarError(
        db.query(
          `insert into descuentos_asociados (comercio, descripcion) values ('Trucho', 'Descuento falso')`,
        ),
        /row-level security/,
      );
      // update/delete sin filas visibles para escribir: no afectan nada.
      await db.query(`update descuentos_asociados set descripcion = 'Hackeado'`);
      await db.query(`delete from descuentos_asociados`);
    });
    expect(await contar(`select * from descuentos_asociados`)).toBe(6);
    expect(await contar(`select * from descuentos_asociados where descripcion = 'Hackeado'`)).toBe(
      0,
    );
  });

  it("no puede ejecutar los helpers internos", async () => {
    await conRol(como(JUAN), async () => {
      await esperarError(db.query(`select _bloquear_cliente($1)`, [MARTIN]), SIN_PERMISO);
      await esperarError(db.query(`select _exigir_barbero()`), SIN_PERMISO);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("barbero: lectura", () => {
  it("ve todos los perfiles, cortes y descuentos", async () => {
    await conRol(como(BARBERO), async () => {
      expect(await contar(`select * from perfiles`)).toBe(16); // 3 barberos (con el admin) + 13 clientes
      expect(await contar(`select * from resumen_clientes`)).toBe(13);
      expect(await contar(`select * from descuentos_asociados`)).toBe(6);
      expect(await contar(`select * from cortes`)).toBe(74);
    });
  });

  it("resumen_clientes calcula sellos y premios", async () => {
    const r = await conRol(como(BARBERO), () =>
      filas<{
        id: string;
        total_cortes: number;
        sellos_actuales: number;
        premios_disponibles: number;
      }>(
        `select id, total_cortes, sellos_actuales, premios_disponibles from resumen_clientes where id = any($1)`,
        [[JUAN, MARTIN, LUCAS, JOAQUIN]],
      ),
    );
    const por = Object.fromEntries(r.map((x) => [x.id, x]));
    expect(por[JUAN]).toMatchObject({
      total_cortes: 4,
      sellos_actuales: 4,
      premios_disponibles: 1,
    });
    expect(por[MARTIN]).toMatchObject({
      total_cortes: 5,
      sellos_actuales: 5,
      premios_disponibles: 1,
    });
    // 12 cortes = una tarjeta completa (4, 7 y 10) + 2 sellos. Los 2 canjes de la
    // regla anterior (etapa 5, que ya no existe) se descuentan desde la etapa 4.
    expect(por[LUCAS]).toMatchObject({
      total_cortes: 12,
      sellos_actuales: 2,
      premios_disponibles: 1,
    });
    expect(por[JOAQUIN]).toMatchObject({
      total_cortes: 15,
      sellos_actuales: 5,
      premios_disponibles: 2,
    });
  });

  it("resumen_clientes detalla los premios por etapa", async () => {
    const r = await conRol(como(BARBERO), () =>
      fila<{ etapas: unknown; premios: { corte: number; disponibles: number }[] }>(
        `select etapas, premios from resumen_clientes where id = $1`,
        [JOAQUIN],
      ),
    );
    expect(r.etapas).toEqual([
      { corte: 4, descripcion: "20% off" },
      { corte: 7, descripcion: "50% off" },
      { corte: 10, descripcion: "Corte gratis" },
    ]);
    // 15 cortes: la etapa 4 se ganó 2 veces; la 7 y la 10, una. Menos 2 canjes viejos.
    expect(r.premios).toEqual([
      { corte: 4, descripcion: "20% off", ganados: 2, canjeados: 0, disponibles: 0 },
      { corte: 7, descripcion: "50% off", ganados: 1, canjeados: 0, disponibles: 1 },
      { corte: 10, descripcion: "Corte gratis", ganados: 1, canjeados: 0, disponibles: 1 },
    ]);
  });

  it("busca sin importar tildes ni mayúsculas, y por teléfono", async () => {
    const porNombre = await conRol(como(BARBERO), () =>
      filas<{ id: string }>(`select id from resumen_clientes where busqueda ilike $1`, ["%perez%"]),
    );
    expect(porNombre.map((r) => r.id)).toEqual([JUAN]);
    const porTelefono = await conRol(como(BARBERO), () =>
      filas<{ id: string }>(`select id from resumen_clientes where busqueda ilike $1`, ["%40112%"]),
    );
    expect(porTelefono.map((r) => r.id)).toEqual([JUAN]);
  });

  it("metricas_panel devuelve los totales", async () => {
    const m = await conRol(como(BARBERO), () =>
      fila<{ clientes_total: number; canjes_total: number; premios_pendientes: number }>(
        `select * from metricas_panel()`,
      ),
    );
    expect(m.clientes_total).toBe(13);
    expect(m.canjes_total).toBe(8);
    // Martín (5), Joaquín (15/2), Facundo (10/1), Matías (9/1 → 0)...
    expect(m.premios_pendientes).toBeGreaterThanOrEqual(3);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("barbero: registrar_corte", () => {
  it("suma un corte y registra quién lo cargó", async () => {
    const corte = await conRol(como(BARBERO), () =>
      fila<{ cliente_id: string; registrado_por: string }>(`select * from registrar_corte($1)`, [
        SANTIAGO,
      ]),
    );
    expect(corte).toMatchObject({ cliente_id: SANTIAGO, registrado_por: BARBERO });
    expect(await contar(`select * from cortes where cliente_id = $1`, [SANTIAGO])).toBe(4);
  });

  it("rechaza un segundo corte al mismo cliente dentro del minuto", async () => {
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select registrar_corte($1)`, [SANTIAGO]), /corte_reciente/),
    );
    expect(await contar(`select * from cortes where cliente_id = $1`, [SANTIAGO])).toBe(4);
  });

  it("es idempotente: la misma solicitud no duplica", async () => {
    const solicitud = "f0000000-0000-4000-8000-000000000001";
    // Movemos el último corte de Santiago para que no aplique el límite de 60 s.
    await db.exec(
      `update cortes set fecha = fecha - interval '2 minutes' where cliente_id = '${SANTIAGO}'`,
    );
    const [a, b] = await conRol(como(BARBERO), async () => [
      await fila<{ id: string }>(`select * from registrar_corte($1, $2)`, [SANTIAGO, solicitud]),
      await fila<{ id: string }>(`select * from registrar_corte($1, $2)`, [SANTIAGO, solicitud]),
    ]);
    expect(a.id).toBe(b.id);
    expect(await contar(`select * from cortes where cliente_id = $1`, [SANTIAGO])).toBe(5);
    await conRol(como(BARBERO), () =>
      esperarError(
        db.query(`select registrar_corte($1, $2)`, [JUAN, solicitud]),
        /solicitud_invalida/,
      ),
    );
  });

  it("rechaza clientes inexistentes o que no son clientes", async () => {
    await conRol(como(BARBERO), async () => {
      await esperarError(db.query(`select registrar_corte($1)`, [BARBERO]), /cliente_inexistente/);
      await esperarError(
        db.query(`select registrar_corte($1)`, [SIN_PERFIL]),
        /cliente_inexistente/,
      );
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("barbero: canjear_premio", () => {
  it("canjea un premio disponible y guarda la descripción vigente", async () => {
    const canje = await conRol(como(BARBERO), () =>
      fila<{ premio_descripcion: string; registrado_por: string }>(
        `select * from canjear_premio($1, $2)`,
        [MARTIN, "f0000000-0000-4000-8000-000000000010"],
      ),
    );
    // Sin decir la etapa (como la versión anterior de la app): el primer premio disponible.
    expect(canje).toMatchObject({
      premio_descripcion: "20% off",
      etapa: 4,
      registrado_por: BARBERO,
    });
  });

  it("no permite canjear dos veces el mismo premio (doble toque o reintento)", async () => {
    await conRol(como(BARBERO), async () => {
      // Misma solicitud (doble toque): devuelve el mismo canje, sin duplicar.
      await db.query(`select canjear_premio($1, $2)`, [
        MARTIN,
        "f0000000-0000-4000-8000-000000000010",
      ]);
      // Solicitud nueva: ya no quedan premios.
      await esperarError(
        db.query(`select canjear_premio($1, $2)`, [MARTIN, "f0000000-0000-4000-8000-000000000011"]),
        /sin_premios/,
      );
      await esperarError(db.query(`select canjear_premio($1)`, [MARTIN]), /sin_premios/);
    });
    expect(await contar(`select * from canjes where cliente_id = $1`, [MARTIN])).toBe(1);
    const r = await fila<{ premios_disponibles: number }>(
      `select premios_disponibles from resumen_clientes where id = $1`,
      [MARTIN],
    );
    expect(r.premios_disponibles).toBe(0);
  });

  it("rechaza canjes sin premios disponibles o de etapas que no existen", async () => {
    await conRol(como(BARBERO), async () => {
      await esperarError(db.query(`select canjear_premio($1)`, [EZEQUIEL]), /sin_premios/);
      // Lucas tiene el corte gratis, pero no el 20% off.
      await esperarError(db.query(`select canjear_premio($1, null, 4)`, [LUCAS]), /sin_premios/);
      await esperarError(
        db.query(`select canjear_premio($1, null, 5)`, [LUCAS]),
        /etapa_inexistente/,
      );
    });
    expect(await contar(`select * from canjes where cliente_id = $1`, [LUCAS])).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("barbero: deshacer_corte", () => {
  it("deshace un corte reciente", async () => {
    const corte = await conRol(como(BARBERO), () =>
      fila<{ id: string }>(`select * from registrar_corte($1)`, [LUCAS]),
    );
    await conRol(como(BARBERO), () => db.query(`select deshacer_corte($1)`, [corte.id]));
    expect(await contar(`select * from cortes where id = $1`, [corte.id])).toBe(0);
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [corte.id]), /corte_inexistente/),
    );
  });

  it("el empleado no deshace cortes de hace más de 10 minutos", async () => {
    const viejo = await fila<{ id: string }>(
      `insert into cortes (cliente_id, fecha, registrado_por) values ($1, now() - interval '11 minutes', $2) returning id`,
      [LUCAS, EMPLEADO],
    );
    await conRol(como(EMPLEADO), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [viejo.id]), /fuera_de_plazo/),
    );
    await db.query(`delete from cortes where id = $1`, [viejo.id]);
  });

  it("el dueño deshace cortes del mismo día, aunque pasaran los 10 minutos", async () => {
    // Hace 11 minutos o, si recién empezó el día, a las 00:00 (sigue siendo hoy).
    const deHoy = await fila<{ id: string }>(
      `insert into cortes (cliente_id, fecha, registrado_por) values ($1, greatest(
         now() - interval '11 minutes',
         date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'
       ), $2) returning id`,
      [LUCAS, EMPLEADO],
    );
    await conRol(como(BARBERO), () => db.query(`select deshacer_corte($1)`, [deHoy.id]));
    expect(await contar(`select * from cortes where id = $1`, [deHoy.id])).toBe(0);
  });

  it("el dueño no deshace cortes de días anteriores", async () => {
    const deAyer = await fila<{ id: string }>(
      `insert into cortes (cliente_id, fecha, registrado_por) values ($1, now() - interval '1 day 1 minute', $2) returning id`,
      [LUCAS, BARBERO],
    );
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [deAyer.id]), /fuera_de_plazo/),
    );
    await db.query(`delete from cortes where id = $1`, [deAyer.id]);
  });

  it("no deshace el corte que ganó un premio ya canjeado", async () => {
    // Juan tiene 4: con el 7.º gana el 50% off, se canjea, y después se intenta deshacer.
    let septimo = { id: "" };
    for (let i = 0; i < 3; i++) {
      await db.exec(
        `update cortes set fecha = fecha - interval '2 minutes' where cliente_id = '${JUAN}'`,
      );
      septimo = await conRol(como(BARBERO), () =>
        fila<{ id: string }>(`select * from registrar_corte($1)`, [JUAN]),
      );
    }
    await conRol(como(BARBERO), () => db.query(`select canjear_premio($1, null, 7)`, [JUAN]));
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [septimo.id]), /premio_ya_canjeado/),
    );
    expect(await contar(`select * from cortes where id = $1`, [septimo.id])).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("barbero: reglas y descuentos", () => {
  it("guardar_regla reemplaza la activa y conserva el historial", async () => {
    const nueva = await conRol(como(BARBERO), () =>
      fila<{ id: string; activa: boolean }>(`select * from guardar_regla(3, '  Corte gratis  ')`),
    );
    expect(nueva.activa).toBe(true);
    const reglas = await filas<{ activa: boolean; descripcion_premio: string }>(
      `select activa, descripcion_premio from reglas order by created_at`,
    );
    expect(reglas.filter((r) => r.activa)).toHaveLength(1);
    expect(reglas.at(-1)?.descripcion_premio).toBe("Corte gratis");
    expect(reglas.length).toBeGreaterThanOrEqual(2);

    // Mismos valores: no crea otra versión.
    const igual = await conRol(como(BARBERO), () =>
      fila<{ id: string }>(`select * from guardar_regla(3, 'Corte gratis')`),
    );
    expect(igual.id).toBe(nueva.id);

    // El resumen se recalcula con la regla nueva: Lucas 12 cortes / 3 = 4 premios − 2 canjes.
    const lucas = await fila<{ premios_disponibles: number; sellos_actuales: number }>(
      `select premios_disponibles, sellos_actuales from resumen_clientes where id = $1`,
      [LUCAS],
    );
    expect(lucas).toEqual({ premios_disponibles: 2, sellos_actuales: 0 });

    const activa = await fila<{ etapas: unknown }>(`select etapas from reglas where activa`);
    expect(activa.etapas).toEqual([{ corte: 3, descripcion: "Corte gratis" }]);

    await conRol(como(BARBERO), () =>
      db.query(`select guardar_regla_etapas($1::jsonb)`, [JSON.stringify(ETAPAS_SEED)]),
    );
  });

  it("guardar_regla valida los valores", async () => {
    await conRol(como(BARBERO), async () => {
      await esperarError(db.query(`select guardar_regla(0, 'Nada')`), /etapas_invalidas/);
      await esperarError(db.query(`select guardar_regla(31, 'Mucho')`), /etapas_invalidas/);
      await esperarError(db.query(`select guardar_regla(5, 'x')`), /etapas_invalidas/);
    });
    expect(await contar(`select * from reglas where activa`)).toBe(1);
  });

  it("el barbero crea, edita y borra descuentos", async () => {
    await conRol(como(BARBERO), async () => {
      const d = await fila<{ id: string }>(
        `insert into descuentos_asociados (comercio, descripcion) values ('Heladería Polo', '2x1 en cucuruchos') returning id`,
      );
      await db.query(`update descuentos_asociados set activo = false where id = $1`, [d.id]);
      expect(
        await contar(`select * from descuentos_asociados where id = $1 and not activo`, [d.id]),
      ).toBe(1);
      await db.query(`delete from descuentos_asociados where id = $1`, [d.id]);
      expect(await contar(`select * from descuentos_asociados where id = $1`, [d.id])).toBe(0);
    });
  });

  it("valida la vigencia de los descuentos", async () => {
    await conRol(como(BARBERO), () =>
      esperarError(
        db.query(
          `insert into descuentos_asociados (comercio, descripcion, vigente_desde, vigente_hasta) values ('Kiosco', 'Inválido', '2026-05-10', '2026-05-01')`,
        ),
        /descuentos_vigencia_valida/,
      ),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Dueño y empleado, precios y montos (migración 20261022000100).
// ════════════════════════════════════════════════════════════════════════════

const MIGRACION_BARBEROS = "20261022000100_barberos_y_precios.sql";

describe("migración sobre una base con datos (como producción)", () => {
  it("el barbero existente queda como dueño y los cortes viejos siguen funcionando", async () => {
    const base = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
    const ejecutar = (sql: string) => base.exec(sql);
    const leer = async <T>(sql: string, params: unknown[] = []) =>
      (await base.query<T>(sql, params)).rows;
    const comoBarbero = (sql: string) =>
      ejecutar(
        `select set_config('request.jwt.claims', '{"role":"authenticated","sub":"${BARBERO}"}', false); set role authenticated; ${sql}; reset role;`,
      );
    try {
      await ejecutar(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
      const archivos = readdirSync(join(RAIZ, "migrations")).sort();
      const anteriores = archivos.filter((a) => a < MIGRACION_BARBEROS);
      const nuevas = archivos.filter((a) => a >= MIGRACION_BARBEROS);
      expect(nuevas[0]).toBe(MIGRACION_BARBEROS);
      for (const a of anteriores) await ejecutar(readFileSync(join(RAIZ, "migrations", a), "utf8"));

      // Estado de producción antes de la migración: un barbero, un cliente y un corte.
      await ejecutar(`
        insert into auth.users (id, email) values ('${BARBERO}', 'dueno@x.com'), ('${JUAN}', 'juan@x.com');
        insert into perfiles (id, nombre, rol, debe_cambiar_password) values ('${BARBERO}', 'Leandro', 'barbero', false);
        insert into perfiles (id, nombre, telefono) values ('${JUAN}', 'Juan', '2346401122');`);
      await comoBarbero(
        `select registrar_corte('${JUAN}', 'a0000000-0000-4000-8000-000000000001')`,
      );

      for (const a of nuevas) await ejecutar(readFileSync(join(RAIZ, "migrations", a), "utf8"));

      const [barbero] = await leer<{ es_dueno: boolean; precio_habitual: string | null }>(
        `select es_dueno, precio_habitual from perfiles where id = $1`,
        [BARBERO],
      );
      expect(barbero).toEqual({ es_dueno: true, precio_habitual: null });
      const [corte] = await leer<{ monto: string | null; registrado_por: string }>(
        `select monto, registrado_por from cortes`,
      );
      expect(corte).toEqual({ monto: null, registrado_por: BARBERO });

      // La versión anterior de la app llama a registrar_corte sin monto: sigue andando.
      await ejecutar(`update cortes set fecha = fecha - interval '2 minutes'`);
      await comoBarbero(
        `select registrar_corte(p_cliente_id => '${JUAN}', p_solicitud_id => 'a0000000-0000-4000-8000-000000000002')`,
      );
      await comoBarbero(`create temp table t as select * from resumen_clientes`);
      const [resumen] = await leer<{ total_cortes: number; precio_habitual: string | null }>(
        `select total_cortes, precio_habitual from t`,
      );
      expect(resumen).toEqual({ total_cortes: 2, precio_habitual: null });
    } finally {
      await base.close();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("empleado: lectura", () => {
  it("es barbero pero no dueño", async () => {
    const r = await conRol(como(EMPLEADO), () =>
      fila<{ barbero: boolean; dueno: boolean }>(
        `select es_barbero() as barbero, es_dueno() as dueno`,
      ),
    );
    expect(r).toEqual({ barbero: true, dueno: false });
    const d = await conRol(como(BARBERO), () =>
      fila<{ dueno: boolean }>(`select es_dueno() as dueno`),
    );
    expect(d.dueno).toBe(true);
  });

  it("solo ve los cortes (y montos) que cargó él", async () => {
    const suyos = await contar(`select * from cortes where registrado_por = $1`, [EMPLEADO]);
    expect(suyos).toBeGreaterThan(0);
    await conRol(como(EMPLEADO), async () => {
      expect(await contar(`select * from cortes`)).toBe(suyos);
      expect(
        await contar(`select * from cortes where registrado_por is distinct from $1`, [EMPLEADO]),
      ).toBe(0);
      expect(await contar(`select monto from cortes where registrado_por = $1`, [BARBERO])).toBe(0);
      expect(await contar(`select * from cortes where cliente_id = $1`, [JOAQUIN])).toBe(0);
      expect(await contar(`select * from cortes where monto is not null`)).toBe(suyos);
    });
  });

  it("la tarjeta de sellos cuenta todos los cortes, los haya cargado quien sea", async () => {
    const consulta = `select id, total_cortes, sellos_actuales, premios_disponibles, ultimo_corte
                      from resumen_clientes where id = any($1) order by id`;
    const ids = [[FACUNDO, LUCAS, JOAQUIN, TOMAS]];
    const delDueno = await conRol(como(BARBERO), () => filas(consulta, ids));
    const delEmpleado = await conRol(como(EMPLEADO), () => filas(consulta, ids));
    expect(delEmpleado).toEqual(delDueno);
    expect(delEmpleado).toHaveLength(4);
  });

  it("ve el precio habitual del cliente para cobrarlo", async () => {
    const r = await conRol(como(EMPLEADO), () =>
      fila<{ precio_habitual: string | null }>(
        `select precio_habitual from resumen_clientes where id = $1`,
        [FACUNDO],
      ),
    );
    expect(Number(r.precio_habitual)).toBeGreaterThanOrEqual(8000);
  });

  it("en las métricas solo cuenta sus propios cortes", async () => {
    const empleado = await conRol(como(EMPLEADO), () =>
      fila<{ cortes_mes: number; clientes_total: number }>(`select * from metricas_panel()`),
    );
    const dueno = await conRol(como(BARBERO), () =>
      fila<{ cortes_mes: number; clientes_total: number }>(`select * from metricas_panel()`),
    );
    const suyosDelMes = await contar(
      `select * from cortes where registrado_por = $1
         and fecha >= date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'`,
      [EMPLEADO],
    );
    expect(empleado.cortes_mes).toBe(suyosDelMes);
    expect(empleado.cortes_mes).toBeLessThanOrEqual(dueno.cortes_mes);
    expect(empleado.clientes_total).toBe(dueno.clientes_total);
  });

  it("un cliente sigue viendo todos sus cortes, los cargue quien los cargue", async () => {
    const delEmpleado = await contar(
      `select * from cortes where cliente_id = $1 and registrado_por = $2`,
      [LUCAS, EMPLEADO],
    );
    expect(delEmpleado).toBeGreaterThan(0);
    const total = await contar(`select * from cortes where cliente_id = $1`, [LUCAS]);
    await conRol(como(LUCAS), async () => {
      expect(await contar(`select * from cortes`)).toBe(total);
      const r = await fila<{ total_cortes: number }>(`select total_cortes from resumen_clientes`);
      expect(r.total_cortes).toBe(total);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("empleado: lo que no puede hacer", () => {
  it("no puede ver la facturación, cambiar la regla ni los precios", async () => {
    await conRol(como(EMPLEADO), async () => {
      await esperarError(
        db.query(`select * from facturacion(current_date - 30, current_date)`),
        /no_autorizado/,
      );
      await esperarError(db.query(`select guardar_regla(2, 'Corte gratis')`), /no_autorizado/);
      await esperarError(
        db.query(`select guardar_precio_cliente($1, 1)`, [FACUNDO]),
        /no_autorizado/,
      );
      await esperarError(db.query(`select _exigir_dueno()`), SIN_PERMISO);
    });
    expect(await contar(`select * from reglas where activa and cortes_necesarios = 2`)).toBe(0);
  });

  it("no puede escribir montos, precios ni cortes de forma directa", async () => {
    await conRol(como(EMPLEADO), async () => {
      await esperarError(db.query(`update cortes set monto = 1`), SIN_PERMISO);
      await esperarError(
        db.query(`update cortes set registrado_por = $1`, [EMPLEADO]),
        SIN_PERMISO,
      );
      await esperarError(
        db.query(`update perfiles set precio_habitual = 1 where id = $1`, [FACUNDO]),
        SIN_PERMISO,
      );
      await esperarError(
        db.query(`update perfiles set es_dueno = true where id = $1`, [EMPLEADO]),
        SIN_PERMISO,
      );
      await esperarError(
        db.query(`insert into cortes (cliente_id, monto) values ($1, 1)`, [FACUNDO]),
        SIN_PERMISO,
      );
    });
    const empleado = await fila<{ es_dueno: boolean }>(
      `select es_dueno from perfiles where id = $1`,
      [EMPLEADO],
    );
    expect(empleado.es_dueno).toBe(false);
  });

  it("no puede crear, editar ni borrar descuentos", async () => {
    await conRol(como(EMPLEADO), async () => {
      await esperarError(
        db.query(
          `insert into descuentos_asociados (comercio, descripcion) values ('Trucho', 'Descuento falso')`,
        ),
        /row-level security/,
      );
      await db.query(`update descuentos_asociados set descripcion = 'Hackeado'`);
      await db.query(`delete from descuentos_asociados`);
    });
    expect(await contar(`select * from descuentos_asociados`)).toBe(6);
    expect(await contar(`select * from descuentos_asociados where descripcion = 'Hackeado'`)).toBe(
      0,
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("empleado: cortes y canjes", () => {
  it("registra un corte con monto, a su nombre, de forma idempotente", async () => {
    const solicitud = "f0000000-0000-4000-8000-000000000020";
    const antes = await contar(`select * from cortes where cliente_id = $1`, [NICOLAS]);
    const [a, b] = await conRol(como(EMPLEADO), async () => [
      await fila<{ id: string; monto: string; registrado_por: string }>(
        `select * from registrar_corte($1, $2, $3)`,
        [NICOLAS, solicitud, 9000],
      ),
      // Doble toque / reintento: misma solicitud, mismo corte.
      await fila<{ id: string; monto: string; registrado_por: string }>(
        `select * from registrar_corte($1, $2, $3)`,
        [NICOLAS, solicitud, 9000],
      ),
    ]);
    expect(a.id).toBe(b.id);
    expect({ monto: Number(a.monto), registrado_por: a.registrado_por }).toEqual({
      monto: 9000,
      registrado_por: EMPLEADO,
    });
    expect(await contar(`select * from cortes where cliente_id = $1`, [NICOLAS])).toBe(antes + 1);
  });

  it("redondea a centavos y rechaza montos inválidos", async () => {
    await conRol(como(EMPLEADO), async () => {
      await esperarError(
        db.query(`select registrar_corte($1, null, -1)`, [AGUSTIN]),
        /monto_invalido/,
      );
      await esperarError(
        db.query(`select registrar_corte($1, null, 10000000)`, [AGUSTIN]),
        /monto_invalido/,
      );
    });
    expect(await contar(`select * from cortes where cliente_id = $1`, [AGUSTIN])).toBe(0);
    const c = await conRol(como(EMPLEADO), () =>
      fila<{ monto: string }>(`select * from registrar_corte($1, null, 8500.555)`, [AGUSTIN]),
    );
    expect(Number(c.monto)).toBe(8500.56);
  });

  it("deshace sus propios cortes, pero no los del dueño", async () => {
    const suyo = await fila<{ id: string }>(
      `select id from cortes where cliente_id = $1 order by fecha desc limit 1`,
      [NICOLAS],
    );
    await conRol(como(EMPLEADO), () => db.query(`select deshacer_corte($1)`, [suyo.id]));
    expect(await contar(`select * from cortes where id = $1`, [suyo.id])).toBe(0);

    const delDueno = await conRol(como(BARBERO), () =>
      fila<{ id: string }>(`select * from registrar_corte($1, null, 8500)`, [EZEQUIEL]),
    );
    await conRol(como(EMPLEADO), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [delDueno.id]), /corte_ajeno/),
    );
    expect(await contar(`select * from cortes where id = $1`, [delDueno.id])).toBe(1);
  });

  it("el dueño puede deshacer un corte reciente del empleado", async () => {
    const delEmpleado = await conRol(como(EMPLEADO), () =>
      fila<{ id: string }>(`select * from registrar_corte($1, null, 9000)`, [TOMAS]),
    );
    await conRol(como(BARBERO), () => db.query(`select deshacer_corte($1)`, [delEmpleado.id]));
    expect(await contar(`select * from cortes where id = $1`, [delEmpleado.id])).toBe(0);
  });

  it("canjea premios", async () => {
    const antes = await fila<{ premios_disponibles: number }>(
      `select premios_disponibles from resumen_clientes where id = $1`,
      [FACUNDO],
    );
    expect(antes.premios_disponibles).toBeGreaterThan(0);
    const canje = await conRol(como(EMPLEADO), () =>
      fila<{ registrado_por: string }>(`select * from canjear_premio($1, $2)`, [
        FACUNDO,
        "f0000000-0000-4000-8000-000000000021",
      ]),
    );
    expect(canje.registrado_por).toBe(EMPLEADO);
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("dueño: precios, montos y facturación", () => {
  it("los cortes viejos (sin monto) se siguen leyendo y contando", async () => {
    const sinMonto = await contar(`select * from cortes where monto is null`);
    expect(sinMonto).toBeGreaterThan(0);
    const r = await conRol(como(BARBERO), async () => ({
      visibles: await contar(`select * from cortes where monto is null`),
      joaquin: await fila<{ total_cortes: number }>(
        `select total_cortes from resumen_clientes where id = $1`,
        [JOAQUIN],
      ),
    }));
    expect(r.visibles).toBe(sinMonto);
    expect(r.joaquin.total_cortes).toBe(15);
  });

  it("un corte sin monto queda guardado como 'sin monto'", async () => {
    await db.exec(
      `update cortes set fecha = fecha - interval '2 minutes' where cliente_id = '${EZEQUIEL}'`,
    );
    const c = await conRol(como(BARBERO), () =>
      fila<{ monto: string | null; registrado_por: string }>(
        `select * from registrar_corte($1, $2)`,
        [EZEQUIEL, "f0000000-0000-4000-8000-000000000022"],
      ),
    );
    expect(c).toMatchObject({ monto: null, registrado_por: BARBERO });
  });

  it("edita el precio habitual de un cliente (y lo puede borrar)", async () => {
    await conRol(como(BARBERO), async () => {
      await db.query(`select guardar_precio_cliente($1, $2)`, [AGUSTIN, 9500]);
      const r = await fila<{ precio_habitual: string }>(
        `select precio_habitual from resumen_clientes where id = $1`,
        [AGUSTIN],
      );
      expect(Number(r.precio_habitual)).toBe(9500);
      await db.query(`select guardar_precio_cliente($1, null)`, [AGUSTIN]);
      await esperarError(
        db.query(`select guardar_precio_cliente($1, -5)`, [AGUSTIN]),
        /monto_invalido/,
      );
      await esperarError(
        db.query(`select guardar_precio_cliente($1, 100)`, [EMPLEADO]),
        /cliente_inexistente/,
      );
    });
    const r = await fila<{ precio_habitual: string | null }>(
      `select precio_habitual from perfiles where id = $1`,
      [AGUSTIN],
    );
    expect(r.precio_habitual).toBeNull();
  });

  it("facturacion suma cortes y montos por barbero, incluidos los cortes sin barbero", async () => {
    // Un corte sin barbero (por ejemplo, de un barbero que se eliminó).
    await db.query(
      `insert into cortes (cliente_id, fecha, monto) values ($1, now() - interval '3 days', 1000)`,
      [JOAQUIN],
    );
    const filasFact = await conRol(como(BARBERO), () =>
      filas<{
        barbero_id: string | null;
        es_dueno: boolean;
        cortes: number;
        cortes_sin_monto: number;
        total: string;
      }>(`select * from facturacion(current_date - 365, current_date)`),
    );
    expect(filasFact.map((f) => f.barbero_id)).toEqual([BARBERO, EMPLEADO, null]);

    const esperado = await filas<{ barbero_id: string | null; cortes: number; total: string }>(`
      select registrado_por as barbero_id, count(*)::int as cortes, coalesce(sum(monto), 0) as total
      from cortes
      where fecha >= (current_date - 365)::timestamp at time zone 'America/Argentina/Buenos_Aires'
      group by registrado_por`);
    for (const f of filasFact) {
      const e = esperado.find((x) => x.barbero_id === f.barbero_id);
      expect(f.cortes).toBe(e?.cortes);
      expect(Number(f.total)).toBe(Number(e?.total));
    }
    const sinBarbero = filasFact.find((f) => f.barbero_id === null);
    expect(sinBarbero).toMatchObject({ cortes: 1, cortes_sin_monto: 0 });
    expect(Number(sinBarbero?.total)).toBe(1000);
    expect(filasFact[0]?.cortes_sin_monto).toBeGreaterThan(0);
  });

  it("facturacion valida el período", async () => {
    await conRol(como(BARBERO), () =>
      esperarError(
        db.query(`select * from facturacion(current_date, current_date - 1)`),
        /periodo_invalido/,
      ),
    );
  });

  it("un cliente o un visitante no pueden ver facturación ni cambiar precios", async () => {
    await conRol(como(JUAN), async () => {
      await esperarError(
        db.query(`select * from facturacion(current_date - 30, current_date)`),
        /no_autorizado/,
      );
      await esperarError(db.query(`select guardar_precio_cliente($1, 1)`, [JUAN]), /no_autorizado/);
      await esperarError(db.query(`select registrar_corte($1, null, 1)`, [JUAN]), /no_autorizado/);
    });
    await conRol(ANON, async () => {
      await esperarError(
        db.query(`select * from facturacion(current_date - 30, current_date)`),
        SIN_PERMISO,
      );
      await esperarError(db.query(`select guardar_precio_cliente($1, 1)`, [JUAN]), SIN_PERMISO);
      await esperarError(db.query(`select * from _totales_cliente($1)`, [JUAN]), SIN_PERMISO);
      await esperarError(db.query(`select es_dueno()`), SIN_PERMISO);
    });
  });

  it("_totales_cliente no le cuenta nada a un cliente sobre otro", async () => {
    const r = await conRol(como(JUAN), () => filas(`select * from _totales_cliente($1)`, [LUCAS]));
    expect(r).toEqual([]);
  });

  it("un cliente no puede ser dueño", async () => {
    await esperarError(
      db.query(`update perfiles set es_dueno = true where id = $1`, [JUAN]),
      /perfiles_dueno_es_barbero/,
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Premios por etapas (migración 20261023000100).
// ════════════════════════════════════════════════════════════════════════════

type Premio = {
  corte: number;
  descripcion: string;
  ganados: number;
  canjeados: number;
  disponibles: number;
};

let clientesCreados = 0;

/** Crea un cliente de prueba con `cortes` cortes viejos (de hace días). */
async function nuevoCliente(cortes: number): Promise<string> {
  clientesCreados++;
  const n = String(clientesCreados).padStart(12, "0");
  const id = `e1000000-0000-4000-8000-${n}`;
  await db.exec(`insert into auth.users (id, email) values ('${id}', 'etapas${n}@x.com')`);
  await db.exec(
    `insert into perfiles (id, nombre, telefono) values ('${id}', 'Cliente ${n}', '29${n.slice(-8)}')`,
  );
  await agregarCortesViejos(id, cortes);
  return id;
}

async function agregarCortesViejos(id: string, cantidad: number) {
  if (cantidad <= 0) return;
  await db.exec(`
    insert into cortes (cliente_id, fecha, registrado_por)
    select '${id}', now() - make_interval(days => 400 - g), '${BARBERO}'
    from generate_series(1, ${cantidad}) g`);
}

/** Suma un corte por la función (como el panel), salteando el límite de 60 segundos. */
async function sumarCorte(id: string, rol: Rol = como(BARBERO)) {
  await db.exec(
    `update cortes set fecha = fecha - interval '2 minutes' where cliente_id = '${id}'`,
  );
  return conRol(rol, () => fila<{ id: string }>(`select * from registrar_corte($1)`, [id]));
}

async function premiosDe(id: string) {
  return conRol(como(BARBERO), () =>
    fila<{ premios: Premio[]; premios_disponibles: number; sellos_actuales: number }>(
      `select premios, premios_disponibles, sellos_actuales from resumen_clientes where id = $1`,
      [id],
    ),
  );
}

const disponibles = (premios: Premio[]) =>
  Object.fromEntries(premios.map((p) => [p.corte, p.disponibles]));

function canjear(id: string, etapa: number | null, solicitud: string | null = null) {
  return conRol(como(BARBERO), () =>
    fila<{ id: string; etapa: number; premio_descripcion: string }>(
      `select * from canjear_premio($1, $2, $3)`,
      [id, solicitud, etapa],
    ),
  );
}

describe("premios por etapas: ganar y canjear", () => {
  let cliente = "";

  it("gana cada etapa al llegar a su corte", async () => {
    cliente = await nuevoCliente(3);
    expect(disponibles((await premiosDe(cliente)).premios)).toEqual({ 4: 0, 7: 0, 10: 0 });

    await sumarCorte(cliente); // 4.º corte
    let r = await premiosDe(cliente);
    expect(disponibles(r.premios)).toEqual({ 4: 1, 7: 0, 10: 0 });
    expect(r).toMatchObject({ premios_disponibles: 1, sellos_actuales: 4 });

    await agregarCortesViejos(cliente, 3); // 7 cortes
    r = await premiosDe(cliente);
    expect(disponibles(r.premios)).toEqual({ 4: 1, 7: 1, 10: 0 });
    expect(r.premios_disponibles).toBe(2);
  });

  it("al completar la tarjeta vuelve a empezar y los premios ganados no vencen", async () => {
    await agregarCortesViejos(cliente, 3); // 10 cortes: tarjeta completa
    let r = await premiosDe(cliente);
    expect(disponibles(r.premios)).toEqual({ 4: 1, 7: 1, 10: 1 });
    expect(r).toMatchObject({ premios_disponibles: 3, sellos_actuales: 0 });

    await agregarCortesViejos(cliente, 4); // 14 cortes: segunda vuelta, etapa 4 otra vez
    r = await premiosDe(cliente);
    expect(disponibles(r.premios)).toEqual({ 4: 2, 7: 1, 10: 1 });
    expect(r).toMatchObject({ premios_disponibles: 4, sellos_actuales: 4 });
  });

  it("canjea el premio que elige el barbero y guarda su etapa y descripción", async () => {
    const canje = await canjear(cliente, 7, "f1000000-0000-4000-8000-000000000001");
    expect(canje).toMatchObject({ etapa: 7, premio_descripcion: "50% off" });
    const r = await premiosDe(cliente);
    expect(disponibles(r.premios)).toEqual({ 4: 2, 7: 0, 10: 1 });
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select canjear_premio($1, null, 7)`, [cliente]), /sin_premios/),
    );
  });

  it("es idempotente: la misma solicitud devuelve el mismo canje", async () => {
    const antes = await contar(`select * from canjes where cliente_id = $1`, [cliente]);
    const repetido = await canjear(cliente, 10, "f1000000-0000-4000-8000-000000000001");
    expect(repetido).toMatchObject({ etapa: 7 });
    expect(await contar(`select * from canjes where cliente_id = $1`, [cliente])).toBe(antes);

    const a = await canjear(cliente, 10, "f1000000-0000-4000-8000-000000000002");
    const b = await canjear(cliente, 10, "f1000000-0000-4000-8000-000000000002");
    expect(a.id).toBe(b.id);
    expect(disponibles((await premiosDe(cliente)).premios)).toEqual({ 4: 2, 7: 0, 10: 0 });
  });

  it("sin etapa canjea el primer premio disponible, hasta que no queda ninguno", async () => {
    expect(await canjear(cliente, null)).toMatchObject({ etapa: 4, premio_descripcion: "20% off" });
    expect(await canjear(cliente, null)).toMatchObject({ etapa: 4 });
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select canjear_premio($1)`, [cliente]), /sin_premios/),
    );
    const r = await premiosDe(cliente);
    expect(r.premios_disponibles).toBe(0);
    expect(await contar(`select * from canjes where cliente_id = $1`, [cliente])).toBe(4);
  });

  it("no se puede canjear lo que no se ganó", async () => {
    const otro = await nuevoCliente(6);
    await conRol(como(BARBERO), async () => {
      await esperarError(db.query(`select canjear_premio($1, null, 7)`, [otro]), /sin_premios/);
      await esperarError(db.query(`select canjear_premio($1, null, 10)`, [otro]), /sin_premios/);
      await esperarError(
        db.query(`select canjear_premio($1, null, 8)`, [otro]),
        /etapa_inexistente/,
      );
    });
    expect(await canjear(otro, 4)).toMatchObject({ etapa: 4 });
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select canjear_premio($1, null, 4)`, [otro]), /sin_premios/),
    );
  });

  it("el empleado también canjea premios eligiendo la etapa", async () => {
    const otro = await nuevoCliente(7);
    const canje = await conRol(como(EMPLEADO), () =>
      fila<{ etapa: number; registrado_por: string }>(`select * from canjear_premio($1, null, 7)`, [
        otro,
      ]),
    );
    expect(canje).toEqual(expect.objectContaining({ etapa: 7, registrado_por: EMPLEADO }));
  });
});

describe("premios por etapas: deshacer corte", () => {
  it("deshace el corte que ganó una etapa si ese premio no se canjeó", async () => {
    const id = await nuevoCliente(6);
    const septimo = await sumarCorte(id);
    expect(disponibles((await premiosDe(id)).premios)).toEqual({ 4: 1, 7: 1, 10: 0 });
    // Canjea el de la etapa 4 (ganado antes): el 7.º corte se puede deshacer igual.
    await canjear(id, 4);
    await conRol(como(BARBERO), () => db.query(`select deshacer_corte($1)`, [septimo.id]));
    expect(disponibles((await premiosDe(id)).premios)).toEqual({ 4: 0, 7: 0, 10: 0 });
  });

  it("no deshace el corte que ganó una etapa ya canjeada, aunque queden otros premios", async () => {
    const id = await nuevoCliente(6);
    const septimo = await sumarCorte(id);
    await canjear(id, 7);
    // Sigue teniendo el 20% off, pero el 50% off ya lo usó: no se puede deshacer.
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [septimo.id]), /premio_ya_canjeado/),
    );
    expect(await contar(`select * from cortes where id = $1`, [septimo.id])).toBe(1);
  });

  it("deshace un corte que no ganó nada aunque tenga canjes", async () => {
    const id = await nuevoCliente(7);
    await canjear(id, 7);
    await canjear(id, 4);
    const octavo = await sumarCorte(id);
    await conRol(como(BARBERO), () => db.query(`select deshacer_corte($1)`, [octavo.id]));
    expect(await contar(`select * from cortes where id = $1`, [octavo.id])).toBe(0);
  });
});

describe("premios por etapas: configuración de la regla", () => {
  async function guardarEtapas(etapas: unknown, rol: Rol = como(BARBERO)) {
    return conRol(rol, () =>
      fila<{ id: string; etapas: unknown; cortes_necesarios: number; descripcion_premio: string }>(
        `select * from guardar_regla_etapas($1::jsonb)`,
        [JSON.stringify(etapas)],
      ),
    );
  }

  it("ordena las etapas, recorta espacios y mantiene las columnas de antes", async () => {
    const r = await guardarEtapas([
      { corte: 8, descripcion: "  Corte gratis " },
      { corte: 3, descripcion: "Lavado de regalo" },
    ]);
    expect(r).toMatchObject({
      etapas: [
        { corte: 3, descripcion: "Lavado de regalo" },
        { corte: 8, descripcion: "Corte gratis" },
      ],
      cortes_necesarios: 8,
      descripcion_premio: "Corte gratis",
    });
    // Las mismas etapas: no crea otra versión.
    const igual = await guardarEtapas([
      { corte: 3, descripcion: "Lavado de regalo" },
      { corte: 8, descripcion: "Corte gratis" },
    ]);
    expect(igual.id).toBe(r.id);
    expect(await contar(`select * from reglas where activa`)).toBe(1);
  });

  it("valida las etapas en la base", async () => {
    const malas: unknown[] = [
      [],
      [{ corte: 0, descripcion: "Nada" }],
      [{ corte: 31, descripcion: "Muy lejos" }],
      [{ corte: 4.5, descripcion: "Medio corte" }],
      [{ corte: "4", descripcion: "Texto" }],
      [{ corte: 4, descripcion: "x" }],
      [{ corte: 4, descripcion: "x".repeat(121) }],
      [{ corte: 4 }],
      [
        { corte: 4, descripcion: "Repetido" },
        { corte: 4, descripcion: "Otra vez" },
      ],
      Array.from({ length: 7 }, (_, i) => ({ corte: i + 1, descripcion: `Premio ${i + 1}` })),
      { corte: 4, descripcion: "No es una lista" },
    ];
    const antes = await fila<{ id: string }>(`select id from reglas where activa`);
    for (const etapas of malas) {
      await esperarError(guardarEtapas(etapas), /etapas_invalidas/);
    }
    // Seis etapas y tarjeta de 30 cortes: el máximo.
    const seis = [5, 10, 15, 20, 25, 30].map((corte) => ({
      corte,
      descripcion: `Premio ${corte}`,
    }));
    expect((await guardarEtapas(seis)).cortes_necesarios).toBe(30);
    expect((await fila<{ id: string }>(`select id from reglas where activa`)).id).not.toBe(
      antes.id,
    );
    // Ni siquiera el superusuario puede guardar etapas inválidas o inconsistentes.
    await esperarError(
      db.query(`update reglas set etapas = '[{"corte": 3, "descripcion": "a"}]' where activa`),
      /violates check constraint "reglas_/,
    );
    await guardarEtapas(ETAPAS_SEED);
  });

  it("solo el dueño configura las etapas", async () => {
    const antes = await fila<{ id: string }>(`select id from reglas where activa`);
    const etapas = [{ corte: 1, descripcion: "Todo gratis" }];
    await esperarError(guardarEtapas(etapas, como(EMPLEADO)), /no_autorizado/);
    await esperarError(guardarEtapas(etapas, como(JUAN)), /no_autorizado/);
    await esperarError(guardarEtapas(etapas, ANON), SIN_PERMISO);
    await conRol(como(EMPLEADO), () =>
      esperarError(db.query(`update reglas set etapas = '[]'`), SIN_PERMISO),
    );
    await conRol(como(JUAN), () =>
      esperarError(db.query(`insert into reglas (etapas) values ('[]')`), SIN_PERMISO),
    );
    expect((await fila<{ id: string }>(`select id from reglas where activa`)).id).toBe(antes.id);
  });

  it("cualquiera (sin login) ve las etapas de la regla activa", async () => {
    const r = await conRol(ANON, () => filas<{ etapas: unknown }>(`select etapas from reglas`));
    expect(r).toEqual([{ etapas: ETAPAS_SEED }]);
  });
});

describe("premios por etapas: cambio de regla", () => {
  it("se recalcula con todo el historial sin borrar canjes ni dejar disponibles negativos", async () => {
    // 14 cortes con la regla 4/7/10: ganó 4 ×2, 7 y 10. Canjea el corte gratis y un 20% off.
    const id = await nuevoCliente(14);
    await canjear(id, 10);
    await canjear(id, 4);
    expect(disponibles((await premiosDe(id)).premios)).toEqual({ 4: 1, 7: 1, 10: 0 });
    const canjesAntes = await filas(
      `select id, etapa, premio_descripcion from canjes where cliente_id = $1 order by id`,
      [id],
    );

    // El dueño cambia a "cada 20 cortes, un corte gratis": con 14 cortes no ganó nada
    // y ya canjeó 2. No quedan disponibles negativos y los canjes siguen ahí.
    await conRol(como(BARBERO), () => db.query(`select guardar_regla(20, 'Corte gratis')`));
    let r = await premiosDe(id);
    expect(r.premios).toEqual([
      { corte: 20, descripcion: "Corte gratis", ganados: 0, canjeados: 0, disponibles: 0 },
    ]);
    expect(r).toMatchObject({ premios_disponibles: 0, sellos_actuales: 14 });
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select canjear_premio($1)`, [id]), /sin_premios/),
    );

    // Cambia a 3 etapas en otros cortes: 14 cortes = 4 vueltas de 3 + 2 (gana la etapa 2
    // cinco veces y la 3 cuatro: 9). Los 2 canjes (de etapas que ya no existen) se
    // descuentan desde la etapa de menor corte.
    await conRol(como(BARBERO), () =>
      db.query(`select guardar_regla_etapas($1::jsonb)`, [
        JSON.stringify([
          { corte: 2, descripcion: "Lavado" },
          { corte: 3, descripcion: "Corte gratis" },
        ]),
      ]),
    );
    r = await premiosDe(id);
    expect(disponibles(r.premios)).toEqual({ 2: 3, 3: 4 });
    expect(r.premios_disponibles).toBe(9 - 2);

    // Si se vuelve a la regla anterior, cada canje vuelve a contar en su etapa.
    await conRol(como(BARBERO), () =>
      db.query(`select guardar_regla_etapas($1::jsonb)`, [JSON.stringify(ETAPAS_SEED)]),
    );
    expect(disponibles((await premiosDe(id)).premios)).toEqual({ 4: 1, 7: 1, 10: 0 });
    expect(
      await filas(
        `select id, etapa, premio_descripcion from canjes where cliente_id = $1 order by id`,
        [id],
      ),
    ).toEqual(canjesAntes);
  });

  it("si una etapa queda con más canjes que premios, el sobrante se descuenta de otras", async () => {
    // 7 cortes, canjeó el 50% off de la etapa 7. La etapa 7 pasa al corte 8.
    const id = await nuevoCliente(7);
    await canjear(id, 7);
    await conRol(como(BARBERO), () =>
      db.query(`select guardar_regla_etapas($1::jsonb)`, [
        JSON.stringify([
          { corte: 4, descripcion: "20% off" },
          { corte: 7, descripcion: "50% off" },
          { corte: 8, descripcion: "Corte gratis" },
        ]),
      ]),
    );
    // Ganó 4 y 7 (1 c/u), canjeó 1 de la 7: le queda el 20% off.
    expect(disponibles((await premiosDe(id)).premios)).toEqual({ 4: 1, 7: 0, 8: 0 });

    await conRol(como(BARBERO), () =>
      db.query(`select guardar_regla_etapas($1::jsonb)`, [
        JSON.stringify([
          { corte: 4, descripcion: "20% off" },
          { corte: 9, descripcion: "Corte gratis" },
        ]),
      ]),
    );
    // La etapa 7 ya no existe: su canje se descuenta del 20% off. Total = 1 − 1 = 0.
    const r = await premiosDe(id);
    expect(disponibles(r.premios)).toEqual({ 4: 0, 9: 0 });
    expect(r.premios_disponibles).toBe(0);

    await conRol(como(BARBERO), () =>
      db.query(`select guardar_regla_etapas($1::jsonb)`, [JSON.stringify(ETAPAS_SEED)]),
    );
  });

  it("nunca hay disponibles negativos: total = max(0, ganados − canjes)", async () => {
    const r = await filas<{ premios_disponibles: number; ganados: number; total_canjes: number }>(`
      select premios_disponibles, total_canjes,
             (select coalesce(sum((e->>'ganados')::int), 0) from jsonb_array_elements(premios) e)::int as ganados
      from resumen_clientes`);
    expect(r.length).toBeGreaterThan(10);
    for (const x of r) {
      expect(x.premios_disponibles).toBe(Math.max(0, x.ganados - x.total_canjes));
    }
  });
});

const MIGRACION_ETAPAS = "20261023000100_premios_por_etapas.sql";

describe("migración de premios por etapas sobre una base con datos (como producción)", () => {
  it("ningún cliente cambia lo que ve ni lo que tiene disponible, y la app anterior sigue andando", async () => {
    const base = new PGlite({ extensions: { pg_trgm, pgcrypto } });
    const ejecutar = (sql: string) => base.exec(sql);
    const leer = async <T>(sql: string, params: unknown[] = []) =>
      (await base.query<T>(sql, params)).rows;
    const comoRol = async <T>(sub: string | null, fn: () => Promise<T>) => {
      const claims = sub ? { role: "authenticated", sub } : { role: "anon" };
      await ejecutar(
        `select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false); set role ${sub ? "authenticated" : "anon"};`,
      );
      try {
        return await fn();
      } finally {
        await ejecutar(`reset role; select set_config('request.jwt.claims', '', false);`);
      }
    };
    const resumen = () =>
      comoRol(BARBERO, () =>
        leer<Record<string, unknown>>(
          `select id, total_cortes, total_canjes, cortes_necesarios, descripcion_premio,
                  sellos_actuales, premios_disponibles
           from resumen_clientes order by id`,
        ),
      );

    try {
      await ejecutar(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
      const archivos = readdirSync(join(RAIZ, "migrations")).sort();
      expect(archivos).toContain(MIGRACION_ETAPAS);
      for (const a of archivos.filter((x) => x < MIGRACION_ETAPAS)) {
        await ejecutar(readFileSync(join(RAIZ, "migrations", a), "utf8"));
      }

      // Producción antes de la migración: la regla fue "cada 5" y hoy es "cada 6".
      const clientes = [0, 2, 5, 6, 7, 10, 12, 13, 18, 25];
      const canjesPor = [0, 0, 0, 1, 0, 2, 2, 1, 3, 4]; // algunos con más canjes que premios hoy
      await ejecutar(`
        insert into auth.users (id, email) values ('${BARBERO}', 'dueno@x.com');
        insert into perfiles (id, nombre, rol, debe_cambiar_password, es_dueno)
        values ('${BARBERO}', 'Leandro', 'barbero', false, true);
        update reglas set created_at = now() - interval '300 days';
      `);
      for (const [i, cortes] of clientes.entries()) {
        const id = `e2000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
        await ejecutar(`
          insert into auth.users (id, email) values ('${id}', 'm${i}@x.com');
          insert into perfiles (id, nombre, telefono) values ('${id}', 'Cliente ${i}', '28000000${String(i).padStart(2, "0")}');
          insert into cortes (cliente_id, fecha, registrado_por, monto)
          select '${id}', now() - make_interval(days => 250 - g), '${BARBERO}', 9000
          from generate_series(1, ${cortes}) g;
          insert into canjes (cliente_id, fecha, registrado_por, premio_descripcion)
          select '${id}', now() - make_interval(days => 200 - g), '${BARBERO}', '50% off en el siguiente corte'
          from generate_series(1, ${canjesPor[i]}) g;`);
      }
      await comoRol(BARBERO, () => leer(`select guardar_regla(6, 'Corte gratis')`));
      await ejecutar(`update reglas set created_at = now() - interval '100 days' where activa`);

      const antes = await resumen();
      expect(antes.some((c) => Number(c.premios_disponibles) > 0)).toBe(true);
      await ejecutar(readFileSync(join(RAIZ, "migrations", MIGRACION_ETAPAS), "utf8"));
      const despues = await resumen();
      expect(despues).toEqual(antes);

      // La regla quedó como una etapa, y el historial también.
      const reglas = await leer<{ activa: boolean; etapas: unknown }>(
        `select activa, etapas from reglas order by created_at`,
      );
      expect(reglas).toEqual([
        { activa: false, etapas: [{ corte: 5, descripcion: "50% off en el siguiente corte" }] },
        { activa: true, etapas: [{ corte: 6, descripcion: "Corte gratis" }] },
      ]);
      // Los canjes viejos quedaron con la etapa de la regla de su momento (cada 5).
      expect(await leer(`select distinct etapa from canjes`)).toEqual([{ etapa: 5 }]);

      // La versión anterior de la app: lee las columnas de antes, canjea sin etapa
      // y guarda reglas "cada N cortes".
      const anon = await comoRol(null, () =>
        leer(`select cortes_necesarios, descripcion_premio from reglas`),
      );
      expect(anon).toEqual([{ cortes_necesarios: 6, descripcion_premio: "Corte gratis" }]);
      const conPremio = despues.find((c) => Number(c.premios_disponibles) > 0)!;
      const [canje] = await comoRol(BARBERO, () =>
        leer<{ premio_descripcion: string; etapa: number }>(
          `select * from canjear_premio(p_cliente_id => $1, p_solicitud_id => 'a0000000-0000-4000-8000-000000000009')`,
          [conPremio.id],
        ),
      );
      expect(canje).toMatchObject({ premio_descripcion: "Corte gratis", etapa: 6 });
      const [luego] = await comoRol(BARBERO, () =>
        leer<{ premios_disponibles: number }>(
          `select premios_disponibles from resumen_clientes where id = $1`,
          [conPremio.id],
        ),
      );
      expect(luego?.premios_disponibles).toBe(Number(conPremio.premios_disponibles) - 1);
      await comoRol(BARBERO, () => leer(`select guardar_regla(8, '  Corte gratis  ')`));
      const [nueva] = await leer<{ etapas: unknown; cortes_necesarios: number }>(
        `select etapas, cortes_necesarios from reglas where activa`,
      );
      expect(nueva).toEqual({
        etapas: [{ corte: 8, descripcion: "Corte gratis" }],
        cortes_necesarios: 8,
      });
    } finally {
      await base.close();
    }
  });
});
