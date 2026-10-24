/**
 * Tests de la foto del local en los descuentos (migración
 * 20261027000100_fotos_descuentos.sql): solo el dueño (o el admin) la pone,
 * cambia o quita; la base valida tipo, tamaño y bytes; cada uno la ve si ve
 * el descuento; y se borra con el descuento.
 *
 * Igual que los demás: PGlite con stubs de Supabase, las migraciones y el
 * seed, y cada rol simulado con `set role` + `request.jwt.claims`.
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

type Rol = { rol: "anon" } | { rol: "authenticated"; sub: string };
const ANON: Rol = { rol: "anon" };
const como = (sub: string): Rol => ({ rol: "authenticated", sub });

const SIN_PERMISO = /permission denied|no_autorizado/;
const INVALIDA = /foto_invalida/;

/** Bytes con la "firma" de cada formato (la base mira los primeros bytes). */
const jpeg = (largo = 64) => {
  const b = Buffer.alloc(largo, 7);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b.toString("base64");
};
const webp = (largo = 64) => {
  const b = Buffer.alloc(largo, 7);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(largo - 8, 4);
  b.write("WEBP", 8, "latin1");
  return b.toString("base64");
};
const png = () => {
  const b = Buffer.alloc(64, 7);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b.toString("base64");
};

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

const filas = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;

async function esperarError(promesa: Promise<unknown>, patron: RegExp) {
  await expect(promesa).rejects.toThrow(patron);
}

/** Id de un descuento del seed por el nombre del comercio. */
async function idDe(comercio: string): Promise<string> {
  const [d] = await filas<{ id: string }>(
    `select id from descuentos_asociados where comercio = $1`,
    [comercio],
  );
  if (!d) throw new Error(`No está el descuento ${comercio}`);
  return d.id;
}

const guardar = (id: string, tipo: string, foto: string) =>
  db.query<{ v: string }>(`select guardar_foto_descuento($1, $2, $3) as v`, [id, tipo, foto]);

async function fotoDe(id: string) {
  const [f] = await filas<{ tipo: string; foto: string }>(
    `select tipo, foto from fotos_descuentos where descuento_id = $1`,
    [id],
  );
  const [d] = await filas<{ v: string | null }>(
    `select foto_actualizada_en::text as v from descuentos_asociados where id = $1`,
    [id],
  );
  return { foto: f ?? null, version: d?.v ?? null };
}

let CAFE: string; // vigente
let PIZZERIA: string; // vencido
let OPTICA: string; // pausado

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm, pgcrypto, btree_gist } });
  await db.exec(readFileSync(join(RAIZ, "tests/supabase-stubs.sql"), "utf8"));
  for (const archivo of readdirSync(join(RAIZ, "migrations")).sort()) {
    await db.exec(readFileSync(join(RAIZ, "migrations", archivo), "utf8"));
  }
  await db.exec(readFileSync(join(RAIZ, "seed.sql"), "utf8"));
  CAFE = await idDe("Café del Centro");
  PIZZERIA = await idDe("Pizzería Don Ángel");
  OPTICA = await idDe("Óptica Visión");
});

afterAll(async () => {
  await db?.close();
});

// ════════════════════════════════════════════════════════════════════════════
describe("estructura", () => {
  it("la tabla tiene RLS y nadie le escribe directo (solo las funciones)", async () => {
    const [r] = await filas<{ rls: boolean; leer: boolean; escribir: boolean; anon: boolean }>(`
      select c.relrowsecurity as rls,
             has_table_privilege('authenticated', 'public.fotos_descuentos', 'SELECT') as leer,
             has_table_privilege('authenticated', 'public.fotos_descuentos', 'INSERT')
               or has_table_privilege('authenticated', 'public.fotos_descuentos', 'UPDATE')
               or has_table_privilege('authenticated', 'public.fotos_descuentos', 'DELETE') as escribir,
             has_table_privilege('anon', 'public.fotos_descuentos', 'SELECT') as anon
      from pg_class c where c.oid = 'public.fotos_descuentos'::regclass`);
    expect(r).toEqual({ rls: true, leer: true, escribir: false, anon: false });
  });

  it("las funciones no las puede ejecutar anon", async () => {
    await conRol(ANON, async () => {
      await esperarError(guardar(CAFE, "image/jpeg", jpeg()), /permission denied/);
      await esperarError(db.query(`select quitar_foto_descuento($1)`, [CAFE]), /permission denied/);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("el dueño pone, cambia y quita la foto", () => {
  it("pone una foto JPEG y queda la versión en el descuento", async () => {
    const r = await conRol(como(DUENO), () => guardar(CAFE, "image/jpeg", jpeg()));
    expect(r.rows[0]?.v).toBeTruthy();
    const { foto, version } = await fotoDe(CAFE);
    expect(foto).toEqual({ tipo: "image/jpeg", foto: jpeg() });
    expect(version).not.toBeNull();
  });

  it("la reemplaza por una WebP: una sola foto por descuento y versión nueva", async () => {
    const antes = (await fotoDe(CAFE)).version;
    await conRol(como(DUENO), () => guardar(CAFE, "image/webp", webp(128)));
    const { foto, version } = await fotoDe(CAFE);
    expect(foto).toEqual({ tipo: "image/webp", foto: webp(128) });
    expect(version).not.toBe(antes);
    const [n] = await filas<{ n: number }>(
      `select count(*)::int as n from fotos_descuentos where descuento_id = $1`,
      [CAFE],
    );
    expect(n?.n).toBe(1);
  });

  it("la quita", async () => {
    await conRol(como(DUENO), () => db.query(`select quitar_foto_descuento($1)`, [CAFE]));
    expect(await fotoDe(CAFE)).toEqual({ foto: null, version: null });
    // Quitarla de nuevo no falla.
    await conRol(como(DUENO), () => db.query(`select quitar_foto_descuento($1)`, [CAFE]));
  });

  it("el admin también puede (es dueño)", async () => {
    await conRol(como(ADMIN), () => guardar(OPTICA, "image/jpeg", jpeg()));
    expect((await fotoDe(OPTICA)).foto?.tipo).toBe("image/jpeg");
    await conRol(como(ADMIN), () => db.query(`select quitar_foto_descuento($1)`, [OPTICA]));
    expect((await fotoDe(OPTICA)).foto).toBeNull();
  });

  it("un descuento que no existe da error claro", async () => {
    await conRol(como(DUENO), async () => {
      await esperarError(
        guardar("d0000000-0000-4000-8000-00000000dead", "image/jpeg", jpeg()),
        /descuento_inexistente/,
      );
      await esperarError(
        db.query(`select quitar_foto_descuento($1)`, ["d0000000-0000-4000-8000-00000000dead"]),
        /descuento_inexistente/,
      );
    });
  });

  it("foto_actualizada_en no se escribe a mano (solo las funciones)", async () => {
    await conRol(como(DUENO), async () => {
      await esperarError(
        db.query(`update descuentos_asociados set foto_actualizada_en = now() where id = $1`, [
          CAFE,
        ]),
        /permission denied/,
      );
      // El formulario de siempre sigue funcionando.
      await db.query(`update descuentos_asociados set descripcion = descripcion where id = $1`, [
        CAFE,
      ]);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("empleado y cliente no pueden tocarla", () => {
  beforeAll(async () => {
    await conRol(como(DUENO), () => guardar(CAFE, "image/jpeg", jpeg()));
  });

  for (const [quien, id] of [
    ["empleado", EMPLEADO],
    ["cliente", JUAN],
  ] as const) {
    it(`el ${quien} no pone, cambia ni quita la foto`, async () => {
      await conRol(como(id), async () => {
        await esperarError(guardar(CAFE, "image/webp", webp()), SIN_PERMISO);
        await esperarError(db.query(`select quitar_foto_descuento($1)`, [CAFE]), SIN_PERMISO);
        await esperarError(
          db.query(`insert into fotos_descuentos (descuento_id, tipo, foto) values ($1, $2, $3)`, [
            PIZZERIA,
            "image/jpeg",
            jpeg(),
          ]),
          /permission denied/,
        );
        await esperarError(
          db.query(`update fotos_descuentos set foto = $2 where descuento_id = $1`, [
            CAFE,
            jpeg(80),
          ]),
          /permission denied/,
        );
        await esperarError(
          db.query(`delete from fotos_descuentos where descuento_id = $1`, [CAFE]),
          /permission denied/,
        );
      });
      expect((await fotoDe(CAFE)).foto).toEqual({ tipo: "image/jpeg", foto: jpeg() });
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
describe("quién ve las fotos", () => {
  beforeAll(async () => {
    for (const id of [PIZZERIA, OPTICA]) {
      await conRol(como(DUENO), () => guardar(id, "image/jpeg", jpeg()));
    }
  });

  const visibles = (rol: Rol) =>
    conRol(rol, async () =>
      (await filas<{ descuento_id: string }>(`select descuento_id from fotos_descuentos`))
        .map((f) => f.descuento_id)
        .sort(),
    );

  it("el cliente solo ve las fotos de los descuentos vigentes", async () => {
    expect(await visibles(como(JUAN))).toEqual([CAFE]);
  });

  it("los barberos (dueño y empleado) ven todas", async () => {
    const todas = [CAFE, PIZZERIA, OPTICA].sort();
    expect(await visibles(como(DUENO))).toEqual(todas);
    expect(await visibles(como(EMPLEADO))).toEqual(todas);
  });

  it("anon no ve ninguna", async () => {
    await conRol(ANON, () =>
      esperarError(db.query(`select 1 from fotos_descuentos`), /permission denied/),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("la base valida la foto", () => {
  const rechaza = (tipo: string, foto: string) =>
    conRol(como(DUENO), () => esperarError(guardar(CAFE, tipo, foto), INVALIDA));

  it("solo WebP o JPEG", async () => {
    await rechaza("image/png", png());
    await rechaza("image/gif", jpeg());
    await rechaza("image/svg+xml", Buffer.from("<svg onload=alert(1)>").toString("base64"));
  });

  it("los bytes tienen que coincidir con el tipo", async () => {
    await rechaza("image/jpeg", png());
    await rechaza("image/jpeg", webp());
    await rechaza("image/webp", jpeg());
    await rechaza("image/webp", Buffer.alloc(64, 7).toString("base64"));
  });

  it("base64 válido y hasta 400 KB", async () => {
    await rechaza("image/jpeg", "no es base64!!");
    await rechaza("image/jpeg", "");
    await rechaza("image/jpeg", jpeg(400 * 1024 + 1));
    // Justo 400 KB entra.
    await conRol(como(DUENO), () => guardar(CAFE, "image/jpeg", jpeg(400 * 1024)));
    expect((await fotoDe(CAFE)).foto?.foto.length).toBe(Math.ceil((400 * 1024) / 3) * 4);
  });

  it("la tabla también lo exige (por si se escribe con la clave de servicio)", async () => {
    await esperarError(
      db.query(`insert into fotos_descuentos (descuento_id, tipo, foto) values ($1, $2, $3)`, [
        PIZZERIA,
        "image/png",
        png(),
      ]),
      /fotos_descuentos_tipo_valido/,
    );
    await esperarError(
      db.query(`update fotos_descuentos set foto = 'AAAA' where descuento_id = $1`, [PIZZERIA]),
      /fotos_descuentos_tamano/,
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
describe("borrar el descuento", () => {
  it("borra su foto (cascade)", async () => {
    await conRol(como(DUENO), () => guardar(PIZZERIA, "image/webp", webp()));
    await conRol(como(DUENO), () =>
      db.query(`delete from descuentos_asociados where id = $1`, [PIZZERIA]),
    );
    expect(
      await filas(`select 1 from fotos_descuentos where descuento_id = $1`, [PIZZERIA]),
    ).toEqual([]);
  });
});
