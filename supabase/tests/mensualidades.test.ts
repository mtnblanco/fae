/**
 * Tests de la base para MENSUALIDADES (migración 20261030000200_mensualidades.sql).
 *
 *   · Cualquier barbero cobra la mensualidad (4 cortes) con su medio de pago.
 *   · Cada corte usa uno; no suma sellos. Con el 4.º vuelve a ser cliente común.
 *   · No vence. Una sola activa por cliente.
 *   · La caja suma lo cobrado y cuenta los cortes de mensualidad.
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

type Rol = { rol: "anon" } | { rol: "authenticated"; sub: string };
const ANON: Rol = { rol: "anon" };
const como = (sub: string): Rol => ({ rol: "authenticated", sub });
const SIN_PERMISO = /permission denied/;

type Estado = {
  activa: boolean;
  mensualidad_id: string | null;
  cortes_incluidos: number | null;
  cortes_usados: number;
  usos: Date[];
  precio_barbero: string | null;
};
type Mensualidad = { id: string; barbero_id: string; monto: string; medio_pago: string };
type CorteMensual = { id: string; mensualidad_id: string };

async function nuevaBase() {
  const base = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
  await base.exec(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
  for (const archivo of readdirSync(join(RAIZ, "migrations")).sort()) {
    await base.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  await base.exec(readFileSync(join(RAIZ, "seed.sql"), "utf8"));
  await base.exec(`delete from public.cortes where fecha >= current_date - 1;`);
  return base;
}

describe("mensualidades", () => {
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
  const fila = async <T>(sql: string, params: unknown[] = []) => {
    const [f] = (await db.query<T>(sql, params)).rows;
    if (!f) throw new Error(`Sin filas: ${sql}`);
    return f;
  };
  const esperarError = (p: Promise<unknown>, patron: RegExp) => expect(p).rejects.toThrow(patron);

  const estado = (quien: string, cliente: string) =>
    conRol(como(quien), () => fila<Estado>(`select * from estado_mensualidad($1)`, [cliente]));
  const cobrar = (
    quien: string,
    cliente: string,
    monto: number | null = 40000,
    medio = "efectivo",
  ) =>
    conRol(como(quien), () =>
      fila<Mensualidad>(`select * from cobrar_mensualidad($1, $2, $3)`, [cliente, monto, medio]),
    );
  const usar = (quien: string, cliente: string) =>
    conRol(como(quien), () =>
      fila<CorteMensual>(`select * from usar_corte_mensualidad($1)`, [cliente]),
    );
  // Para usar varios seguidos sin chocar con el anti doble registro (60 s).
  const envejecer = () =>
    db.exec(`update cortes_mensualidad set fecha = fecha - interval '2 minutes'`);
  const sellos = (cliente: string) =>
    fila<{ n: number }>(`select count(*)::int as n from cortes where cliente_id = $1`, [cliente]);

  beforeAll(async () => {
    db = await nuevaBase();
  });
  afterAll(async () => db?.close());

  it("cada barbero guarda su precio; el empleado no toca el de otro", async () => {
    await conRol(como(EMPLEADO), () =>
      db.query(`select guardar_precio_mensualidad($1, 40000)`, [EMPLEADO]),
    );
    await conRol(como(DUENO), () =>
      db.query(`select guardar_precio_mensualidad($1, 45000.5)`, [DUENO]),
    );
    await conRol(como(EMPLEADO), () =>
      esperarError(db.query(`select guardar_precio_mensualidad($1, 1)`, [DUENO]), /no_autorizado/),
    );
    await conRol(como(EMPLEADO), () =>
      esperarError(
        db.query(`select guardar_precio_mensualidad($1, 0)`, [EMPLEADO]),
        /monto_invalido/,
      ),
    );
    // El estado trae el precio de quien pregunta, para precargarlo.
    expect((await estado(EMPLEADO, JUAN)).precio_barbero).toBe("40000.00");
    expect((await estado(DUENO, JUAN)).precio_barbero).toBe("45000.50");
  });

  it("sin mensualidad, el cliente es común: no se puede usar un corte", async () => {
    expect(await estado(EMPLEADO, JUAN)).toMatchObject({ activa: false, cortes_usados: 0 });
    await esperarError(usar(EMPLEADO, JUAN), /sin_mensualidad/);
  });

  it("valida monto, medio de pago y cliente; solo cobra un barbero", async () => {
    await esperarError(cobrar(EMPLEADO, JUAN, null), /monto_invalido/);
    await esperarError(cobrar(EMPLEADO, JUAN, 0), /monto_invalido/);
    await esperarError(cobrar(EMPLEADO, JUAN, 1000, "tarjeta"), /medio_pago_invalido/);
    await esperarError(cobrar(EMPLEADO, EMPLEADO), /cliente_inexistente/);
    await esperarError(cobrar(JUAN, JUAN), /no_autorizado/);
    await conRol(ANON, () =>
      esperarError(db.query(`select cobrar_mensualidad($1, 1, 'efectivo')`, [JUAN]), SIN_PERMISO),
    );
  });

  it("4 cortes que no suman sellos; con el 4.º vuelve a ser común", async () => {
    const sellosAntes = (await sellos(JUAN)).n;
    const m = await cobrar(EMPLEADO, JUAN, 40000, "transferencia");
    expect(m).toMatchObject({
      barbero_id: EMPLEADO,
      monto: "40000.00",
      medio_pago: "transferencia",
    });
    expect(await estado(DUENO, JUAN)).toMatchObject({
      activa: true,
      mensualidad_id: m.id,
      cortes_incluidos: 4,
      cortes_usados: 0,
    });
    // Una sola activa.
    await esperarError(cobrar(DUENO, JUAN), /mensualidad_activa/);

    for (let i = 1; i <= 4; i++) {
      const c = await usar(i % 2 ? EMPLEADO : DUENO, JUAN);
      expect(c.mensualidad_id).toBe(m.id);
      await envejecer();
      if (i < 4) expect((await estado(EMPLEADO, JUAN)).cortes_usados).toBe(i);
    }
    expect((await sellos(JUAN)).n).toBe(sellosAntes);
    expect(await estado(EMPLEADO, JUAN)).toMatchObject({ activa: false, cortes_usados: 0 });
    await esperarError(usar(EMPLEADO, JUAN), /sin_mensualidad/);

    // Vuelve a pagar: otra tarjetita de 4.
    const otra = await cobrar(DUENO, JUAN);
    expect(await estado(EMPLEADO, JUAN)).toMatchObject({
      mensualidad_id: otra.id,
      cortes_usados: 0,
    });
  });

  it("no deja cargar dos cortes seguidos al mismo cliente", async () => {
    await cobrar(EMPLEADO, MARTIN);
    await usar(EMPLEADO, MARTIN);
    await esperarError(usar(EMPLEADO, MARTIN), /corte_reciente/);
  });

  it("deshacer: un corte vuelve a la mensualidad; el cobro, solo si no se usó", async () => {
    const m = await cobrar(EMPLEADO, LUCAS);
    const c = await usar(EMPLEADO, LUCAS);
    await esperarError(
      conRol(como(EMPLEADO), () => db.query(`select deshacer_mensualidad($1)`, [m.id])),
      /mensualidad_usada/,
    );
    // El empleado no deshace lo que cargó el dueño.
    await envejecer();
    const delDueno = await usar(DUENO, LUCAS);
    await esperarError(
      conRol(como(EMPLEADO), () =>
        db.query(`select deshacer_corte_mensualidad($1)`, [delDueno.id]),
      ),
      /mensualidad_ajena/,
    );
    await conRol(como(DUENO), () =>
      db.query(`select deshacer_corte_mensualidad($1)`, [delDueno.id]),
    );
    await conRol(como(EMPLEADO), () => db.query(`select deshacer_corte_mensualidad($1)`, [c.id]));
    expect((await estado(EMPLEADO, LUCAS)).cortes_usados).toBe(0);
    await conRol(como(EMPLEADO), () => db.query(`select deshacer_mensualidad($1)`, [m.id]));
    expect((await estado(EMPLEADO, LUCAS)).activa).toBe(false);
  });

  it("no se devuelve un corte de una mensualidad ya renovada", async () => {
    await db.exec(`delete from cortes_mensualidad where cliente_id = '${LUCAS}'`);
    await cobrar(EMPLEADO, LUCAS);
    let ultimo: CorteMensual | null = null;
    for (let i = 0; i < 4; i++) {
      ultimo = await usar(DUENO, LUCAS);
      await envejecer();
    }
    await cobrar(DUENO, LUCAS);
    await esperarError(
      conRol(como(DUENO), () => db.query(`select deshacer_corte_mensualidad($1)`, [ultimo!.id])),
      /mensualidad_renovada/,
    );
  });

  it("el cliente ve su estado; no el de otro", async () => {
    expect((await estado(JUAN, JUAN)).activa).toBe(true);
    await esperarError(estado(JUAN, MARTIN), /no_autorizado/);
    const propias = await conRol(
      como(JUAN),
      async () =>
        (await db.query<{ cliente_id: string }>(`select cliente_id from mensualidades`)).rows,
    );
    expect(propias.length).toBeGreaterThan(0);
    expect(propias.every((m) => m.cliente_id === JUAN)).toBe(true);
  });

  it("la caja suma lo cobrado y cuenta los cortes de mensualidad", async () => {
    const caja = await conRol(
      como(DUENO),
      async () =>
        (
          await db.query<{
            barbero_id: string;
            total: string;
            transferencia: string;
            mensualidades: number;
            cortes_mensuales: number;
            cortes: number;
          }>(`select * from facturacion(current_date, current_date)`)
        ).rows,
    );
    const empleado = caja.find((f) => f.barbero_id === EMPLEADO)!;
    // Juan (transferencia), Martín y Lucas (efectivo): 3 de 40.000.
    expect(empleado).toMatchObject({ mensualidades: 3, cortes: 0, transferencia: "40000.00" });
    expect(empleado.total).toBe("120000.00");
    expect(empleado.cortes_mensuales).toBeGreaterThan(0);

    const movs = await conRol(
      como(DUENO),
      async () =>
        (
          await db.query<{ tipo: string; servicio_nombre: string; monto: string | null }>(
            `select * from movimientos_caja(current_date, current_date) where cliente_id = $1 order by fecha`,
            [JUAN],
          )
        ).rows,
    );
    // (Los cortes se "envejecieron" para el anti doble registro: el orden por fecha no sirve acá.)
    expect(movs.map((m) => [m.tipo, m.servicio_nombre, m.monto]).sort()).toEqual([
      ["mensual", "Corte de mensualidad 1/4", null],
      ["mensual", "Corte de mensualidad 2/4", null],
      ["mensual", "Corte de mensualidad 3/4", null],
      ["mensual", "Corte de mensualidad 4/4", null],
      ["mensualidad", "Mensualidad (4 cortes)", "40000.00"],
      ["mensualidad", "Mensualidad (4 cortes)", "40000.00"],
    ]);
  });

  it("ninguna función nueva queda ejecutable por PUBLIC ni por anon", async () => {
    const r = (
      await db.query<{ anon: boolean; publico: boolean }>(`
        select has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
               coalesce((select bool_or(a.grantee = 0)
                         from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a), false) as publico
        from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and p.proname in ('_mensualidad_activa', '_exigir_cliente', '_exigir_plazo_deshacer',
            'guardar_precio_mensualidad', 'estado_mensualidad', 'cobrar_mensualidad',
            'usar_corte_mensualidad', 'deshacer_corte_mensualidad', 'deshacer_mensualidad')`)
    ).rows;
    expect(r).toHaveLength(9);
    expect(r.filter((x) => x.publico || x.anon)).toEqual([]);
  });
});
