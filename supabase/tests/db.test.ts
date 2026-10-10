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
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");

const BARBERO = "b0000000-0000-4000-8000-000000000001";
const JUAN = "c0000000-0000-4000-8000-000000000001"; // 4 cortes, 0 canjes
const MARTIN = "c0000000-0000-4000-8000-000000000002"; // 5 cortes → 1 premio
const LUCAS = "c0000000-0000-4000-8000-000000000003"; // 12 cortes, 2 canjes
const SANTIAGO = "c0000000-0000-4000-8000-000000000004"; // 3 cortes
const JOAQUIN = "c0000000-0000-4000-8000-000000000012"; // 15 cortes, 2 canjes
const SIN_PERFIL = "d0000000-0000-4000-8000-000000000001";

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
  db = new PGlite({ extensions: { pg_trgm, pgcrypto } });
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

  it("cortes y canjes están publicados en Realtime", async () => {
    const tablas = await filas<{ tablename: string }>(
      `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`,
    );
    expect(tablas.map((t) => t.tablename)).toEqual(["canjes", "cortes"]);
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
      expect(await contar(`select * from perfiles`)).toBe(14);
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
      premios_disponibles: 0,
    });
    expect(por[MARTIN]).toMatchObject({
      total_cortes: 5,
      sellos_actuales: 0,
      premios_disponibles: 1,
    });
    expect(por[LUCAS]).toMatchObject({
      total_cortes: 12,
      sellos_actuales: 2,
      premios_disponibles: 0,
    });
    expect(por[JOAQUIN]).toMatchObject({
      total_cortes: 15,
      sellos_actuales: 0,
      premios_disponibles: 1,
    });
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
    expect(canje).toMatchObject({
      premio_descripcion: "50% off en el siguiente corte",
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

  it("rechaza canjes sin premios disponibles", async () => {
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select canjear_premio($1)`, [LUCAS]), /sin_premios/),
    );
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

  it("no deshace cortes de hace más de 10 minutos", async () => {
    const viejo = await fila<{ id: string }>(
      `insert into cortes (cliente_id, fecha, registrado_por) values ($1, now() - interval '11 minutes', $2) returning id`,
      [LUCAS, BARBERO],
    );
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [viejo.id]), /fuera_de_plazo/),
    );
    await db.query(`delete from cortes where id = $1`, [viejo.id]);
  });

  it("no deshace el corte que completó un premio ya canjeado", async () => {
    // Juan tiene 4: el 5º completa el premio, se canjea, y después se intenta deshacer.
    await db.exec(
      `update cortes set fecha = fecha - interval '2 minutes' where cliente_id = '${JUAN}'`,
    );
    const quinto = await conRol(como(BARBERO), () =>
      fila<{ id: string }>(`select * from registrar_corte($1)`, [JUAN]),
    );
    await conRol(como(BARBERO), () => db.query(`select canjear_premio($1)`, [JUAN]));
    await conRol(como(BARBERO), () =>
      esperarError(db.query(`select deshacer_corte($1)`, [quinto.id]), /premio_ya_canjeado/),
    );
    expect(await contar(`select * from cortes where id = $1`, [quinto.id])).toBe(1);
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

    await conRol(como(BARBERO), () =>
      db.query(`select guardar_regla(5, '50% off en el siguiente corte')`),
    );
  });

  it("guardar_regla valida los valores", async () => {
    await conRol(como(BARBERO), async () => {
      await esperarError(db.query(`select guardar_regla(0, 'Nada')`), /reglas_cortes_rango/);
      await esperarError(db.query(`select guardar_regla(5, 'x')`), /reglas_descripcion_largo/);
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
