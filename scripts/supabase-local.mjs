// ════════════════════════════════════════════════════════════════════════════
// "Supabase local" para DESARROLLO y DEMOS, sin Docker ni cuenta de Supabase.
//
// Emula la parte de Supabase que usa la app (Auth con email/contraseña, admin
// de usuarios y un subconjunto de la API REST de PostgREST) sobre PGlite, con
// las MISMAS migraciones, el seed y el RLS reales. No tiene Realtime.
//
//   npm run supabase:local     (y en otra terminal: npm run dev)
//
// .env.local para usarlo:
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
//   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-anon-key
//   SUPABASE_SERVICE_ROLE_KEY=local-service-key
//
// ⚠️ Solo para tu computadora. No es seguro ni completo: no lo publiques.
// ════════════════════════════════════════════════════════════════════════════
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const PUERTO = Number(process.env.PUERTO ?? 54321);
const ANON_KEY = "local-anon-key";
const SERVICE_KEY = "local-service-key";
const SECRETO_JWT = randomBytes(32);
const DURACION_TOKEN = 3600;

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase");
// Como PostgREST: fechas y timestamps viajan como texto, no como objetos Date,
// y los numeric (montos) como número.
const comoTexto = (v) => v;
const db = new PGlite({
  extensions: { pg_trgm, pgcrypto, btree_gist },
  parsers: { 1082: comoTexto, 1114: comoTexto, 1184: comoTexto, 1700: Number },
});
await db.exec(readFileSync(join(raiz, "tests/supabase-stubs.sql"), "utf8"));
for (const f of readdirSync(join(raiz, "migrations")).sort()) {
  await db.exec(readFileSync(join(raiz, "migrations", f), "utf8"));
}
await db.exec(readFileSync(join(raiz, "seed.sql"), "utf8"));
await db.exec(`grant all on all tables in schema public to service_role;
  grant execute on all functions in schema public to service_role;`);

// ─── JWT HS256 ──────────────────────────────────────────────────────────────
const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");
const firmar = (datos) => createHmac("sha256", SECRETO_JWT).update(datos).digest("base64url");

function crearJwt(usuario) {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub: usuario.id,
    email: usuario.email,
    role: "authenticated",
    aud: "authenticated",
    iat: ahora,
    exp: ahora + DURACION_TOKEN,
    session_id: randomUUID(),
  })}`;
  return `${cuerpo}.${firmar(cuerpo)}`;
}

function verificarJwt(token) {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const esperado = Buffer.from(firmar(`${h}.${p}`));
  const recibido = Buffer.from(s);
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  return claims.exp > Date.now() / 1000 ? claims : null;
}

const refreshTokens = new Map();

// ─── Utilidades HTTP ────────────────────────────────────────────────────────
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
  "access-control-expose-headers": "content-range, x-supabase-api-version",
  "x-supabase-api-version": "2024-01-01",
};

function responder(res, estado, cuerpo, extra = {}) {
  res.writeHead(estado, { ...CORS, "content-type": "application/json", ...extra });
  res.end(cuerpo === undefined ? "" : JSON.stringify(cuerpo));
}

async function leerCuerpo(req) {
  let texto = "";
  for await (const chunk of req) texto += chunk;
  return texto ? JSON.parse(texto) : {};
}

function errorAuth(res, estado, codigo, mensaje) {
  responder(res, estado, { code: estado, error_code: codigo, msg: mensaje });
}

/** Quién hace el request: service_role, anon o un usuario autenticado. */
function identificar(req) {
  const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (bearer === SERVICE_KEY) return { rol: "service_role" };
  if (!bearer || bearer === ANON_KEY) return { rol: "anon" };
  const claims = verificarJwt(bearer);
  return claims ? { rol: "authenticated", claims } : null;
}

async function comoRol(quien, fn) {
  return db.transaction(async (tx) => {
    if (quien.rol !== "service_role") {
      const claims = quien.claims ?? { role: "anon" };
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      await tx.exec(`set local role ${quien.rol}`);
    }
    return fn(tx);
  });
}

// ─── Auth ───────────────────────────────────────────────────────────────────
async function usuarioPorId(id) {
  const r = await db.query(
    `select id, email, created_at, updated_at from auth.users where id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

function formatoUsuario(u) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.created_at,
    phone: "",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at ?? u.created_at,
  };
}

function sesionPara(usuario) {
  const refresh = randomBytes(24).toString("base64url");
  refreshTokens.set(refresh, usuario.id);
  return {
    access_token: crearJwt(usuario),
    token_type: "bearer",
    expires_in: DURACION_TOKEN,
    expires_at: Math.floor(Date.now() / 1000) + DURACION_TOKEN,
    refresh_token: refresh,
    user: formatoUsuario(usuario),
  };
}

async function manejarAuth(req, res, url) {
  const ruta = url.pathname.replace(/^\/auth\/v1/, "");
  const quien = identificar(req);

  if (ruta === "/token" && req.method === "POST") {
    const cuerpo = await leerCuerpo(req);
    if (url.searchParams.get("grant_type") === "password") {
      const r = await db.query(
        `select id, email, created_at, updated_at from auth.users
         where lower(email) = lower($1) and encrypted_password = extensions.crypt($2, encrypted_password)`,
        [cuerpo.email ?? "", cuerpo.password ?? ""],
      );
      if (!r.rows[0])
        return errorAuth(res, 400, "invalid_credentials", "Invalid login credentials");
      return responder(res, 200, sesionPara(r.rows[0]));
    }
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const id = refreshTokens.get(cuerpo.refresh_token);
      const usuario = id && (await usuarioPorId(id));
      if (!usuario) return errorAuth(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
      return responder(res, 200, sesionPara(usuario));
    }
    return errorAuth(res, 400, "unsupported_grant_type", "Unsupported grant type");
  }

  if (ruta === "/user") {
    if (!quien?.claims) return errorAuth(res, 401, "no_authorization", "Unauthorized");
    const usuario = await usuarioPorId(quien.claims.sub);
    if (!usuario) return errorAuth(res, 404, "user_not_found", "User not found");
    if (req.method === "PUT") {
      const { password } = await leerCuerpo(req);
      if (password) {
        if (password.length < 6)
          return errorAuth(res, 422, "weak_password", "Password should be at least 6 characters.");
        const igual = await db.query(
          `select 1 from auth.users where id = $1 and encrypted_password = extensions.crypt($2, encrypted_password)`,
          [usuario.id, password],
        );
        if (igual.rows.length) {
          return errorAuth(
            res,
            422,
            "same_password",
            "New password should be different from the old password.",
          );
        }
        await db.query(
          `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1`,
          [usuario.id, password],
        );
      }
    }
    return responder(res, 200, formatoUsuario(usuario));
  }

  if (ruta === "/logout") return responder(res, 204);

  const admin = ruta.match(/^\/admin\/users(?:\/([0-9a-f-]+))?$/);
  if (admin) {
    if (quien?.rol !== "service_role") return errorAuth(res, 403, "not_admin", "User not allowed");
    const id = admin[1];
    if (!id && req.method === "POST") {
      const { email, password } = await leerCuerpo(req);
      const existe = await db.query(`select 1 from auth.users where lower(email) = lower($1)`, [
        email,
      ]);
      if (existe.rows.length) {
        return errorAuth(
          res,
          422,
          "email_exists",
          "A user with this email address has already been registered",
        );
      }
      const r = await db.query(
        `insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
         values (gen_random_uuid(), $1, extensions.crypt($2, extensions.gen_salt('bf')), now(), now(), now())
         returning id, email, created_at, updated_at`,
        [email, password],
      );
      return responder(res, 200, formatoUsuario(r.rows[0]));
    }
    const usuario = id && (await usuarioPorId(id));
    if (!usuario) return errorAuth(res, 404, "user_not_found", "User not found");
    if (req.method === "PUT") {
      const { email, password } = await leerCuerpo(req);
      if (email) {
        const existe = await db.query(
          `select 1 from auth.users where lower(email) = lower($1) and id <> $2`,
          [email, id],
        );
        if (existe.rows.length) {
          return errorAuth(
            res,
            422,
            "email_exists",
            "A user with this email address has already been registered",
          );
        }
        await db.query(`update auth.users set email = $2, updated_at = now() where id = $1`, [
          id,
          email,
        ]);
      }
      if (password) {
        await db.query(
          `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1`,
          [id, password],
        );
      }
      return responder(res, 200, formatoUsuario(await usuarioPorId(id)));
    }
    if (req.method === "DELETE") {
      await db.query(`delete from auth.users where id = $1`, [id]);
      return responder(res, 200, formatoUsuario(usuario));
    }
    return responder(res, 200, formatoUsuario(usuario));
  }

  return errorAuth(res, 404, "not_found", "Not found");
}

// ─── REST (subconjunto de PostgREST) ────────────────────────────────────────
const ident = (nombre) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(nombre))
    throw Object.assign(new Error(`Identificador inválido: ${nombre}`), { code: "42601" });
  return `"${nombre}"`;
};

const OPERADORES = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
};

function condicion(columna, expresion, params) {
  let negar = false;
  let resto = expresion;
  if (resto.startsWith("not.")) {
    negar = true;
    resto = resto.slice(4);
  }
  const punto = resto.indexOf(".");
  const op = resto.slice(0, punto);
  let valor = resto.slice(punto + 1);
  let sql;
  if (op === "is") {
    sql = `${ident(columna)} is ${valor === "null" ? "null" : valor === "true" ? "true" : "false"}`;
  } else if (op === "in") {
    const items = valor
      .replace(/^\(|\)$/g, "")
      .split(",")
      .map((v) => v.replace(/^"|"$/g, ""));
    params.push(items);
    sql = `${ident(columna)}::text = any($${params.length})`;
  } else if (OPERADORES[op]) {
    if (op === "like" || op === "ilike") valor = valor.replace(/\*/g, "%");
    params.push(valor);
    sql = `${ident(columna)} ${OPERADORES[op]} $${params.length}`;
  } else {
    throw Object.assign(new Error(`Operador no soportado: ${op}`), { code: "PGRST100" });
  }
  return negar ? `not (${sql})` : sql;
}

function dividirOr(texto) {
  const partes = [];
  let actual = "";
  let profundidad = 0;
  for (const c of texto) {
    if (c === "(") profundidad++;
    if (c === ")") profundidad--;
    if (c === "," && profundidad === 0) {
      partes.push(actual);
      actual = "";
    } else actual += c;
  }
  if (actual) partes.push(actual);
  return partes;
}

const RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function armarWhere(searchParams, params) {
  const condiciones = [];
  for (const [clave, valor] of searchParams) {
    if (RESERVADOS.has(clave)) continue;
    if (clave === "or") {
      const partes = dividirOr(valor.replace(/^\(|\)$/g, "")).map((p) => {
        const i = p.indexOf(".");
        return condicion(p.slice(0, i), p.slice(i + 1), params);
      });
      condiciones.push(`(${partes.join(" or ")})`);
    } else {
      condiciones.push(condicion(clave, valor, params));
    }
  }
  return condiciones.length ? ` where ${condiciones.join(" and ")}` : "";
}

function armarSelect(select) {
  if (!select || select === "*") return "*";
  return select
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      if (c.includes("("))
        throw Object.assign(new Error("Embeds no soportados en el modo local"), {
          code: "PGRST100",
        });
      return c === "*" ? "*" : ident(c);
    })
    .join(", ");
}

function armarOrder(order) {
  if (!order) return "";
  return ` order by ${order
    .split(",")
    .map((o) => {
      const [col, ...mods] = o.split(".");
      const dir = mods.includes("desc") ? "desc" : "asc";
      const nulls = mods.includes("nullsfirst")
        ? " nulls first"
        : mods.includes("nullslast")
          ? " nulls last"
          : "";
      return `${ident(col)} ${dir}${nulls}`;
    })
    .join(", ")}`;
}

const HTTP_POR_CODIGO = { 42501: 403, 23505: 409, 23503: 409, P0002: 404, PGRST116: 406 };

async function manejarRest(req, res, url) {
  const quien = identificar(req);
  if (!quien) return responder(res, 401, { code: "PGRST301", message: "JWT expired" });
  const ruta = url.pathname.replace(/^\/rest\/v1\//, "");
  const prefer = req.headers.prefer ?? "";
  const objeto = (req.headers.accept ?? "").includes("vnd.pgrst.object");

  try {
    // RPC
    const rpc = ruta.match(/^rpc\/(\w+)$/);
    if (rpc) {
      const args =
        req.method === "GET" ? Object.fromEntries(url.searchParams) : await leerCuerpo(req);
      const nombres = Object.keys(args);
      const llamada = `public.${ident(rpc[1])}(${nombres.map((n, i) => `${ident(n)} => $${i + 1}`).join(", ")})`;
      const filas = await comoRol(quien, async (tx) => {
        const tipo = await tx.query(
          `select p.proretset, t.typtype, t.typname from pg_proc p join pg_type t on t.oid = p.prorettype
           where p.proname = $1 and p.pronamespace = 'public'::regnamespace`,
          [rpc[1]],
        );
        const info = tipo.rows[0];
        // Como PostgREST: los objetos y listas viajan como JSON (parámetros jsonb).
        const valores = Object.values(args).map((v) =>
          v !== null && typeof v === "object" ? JSON.stringify(v) : v,
        );
        const r = await tx.query(`select * from ${llamada}`, valores);
        if (info?.typname === "void") return null;
        if (!info || info.proretset) return r.rows;
        if (info.typtype === "c") return r.rows[0] ?? null;
        return Object.values(r.rows[0] ?? {})[0] ?? null;
      });
      return responder(res, 200, filas);
    }

    const tabla = ident(ruta);
    const params = [];
    const where = armarWhere(url.searchParams, params);
    const select = armarSelect(url.searchParams.get("select"));
    const devolver = prefer.includes("return=representation") || url.searchParams.has("select");

    if (req.method === "GET" || req.method === "HEAD") {
      const limit = url.searchParams.get("limit");
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const { filas, total } = await comoRol(quien, async (tx) => {
        const r = await tx.query(
          `select ${select} from public.${tabla}${where}${armarOrder(url.searchParams.get("order"))}${
            limit ? ` limit ${Number(limit)}` : ""
          }${offset ? ` offset ${offset}` : ""}`,
          params,
        );
        let total;
        if (prefer.includes("count=")) {
          const c = await tx.query(
            `select count(*)::int as n from public.${tabla}${where}`,
            params,
          );
          total = c.rows[0].n;
        }
        return { filas: r.rows, total };
      });
      const extra = {};
      if (total !== undefined) {
        extra["content-range"] = filas.length
          ? `${offset}-${offset + filas.length - 1}/${total}`
          : `*/${total}`;
      }
      if (req.method === "HEAD") {
        res.writeHead(200, { ...CORS, ...extra });
        return res.end();
      }
      if (objeto) {
        if (filas.length !== 1) {
          return responder(res, 406, {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
          });
        }
        return responder(res, 200, filas[0], extra);
      }
      return responder(res, 200, filas, extra);
    }

    if (req.method === "POST") {
      const cuerpo = await leerCuerpo(req);
      const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
      const filas = await comoRol(quien, async (tx) => {
        const resultado = [];
        for (const fila of lista) {
          const cols = Object.keys(fila);
          const r = await tx.query(
            `insert into public.${tabla} (${cols.map(ident).join(", ")}) values (${cols
              .map((_, i) => `$${i + 1}`)
              .join(", ")}) returning ${devolver ? select : "1"}`,
            Object.values(fila),
          );
          resultado.push(...r.rows);
        }
        return resultado;
      });
      if (!devolver) return responder(res, 201);
      return responder(res, 201, objeto ? filas[0] : filas);
    }

    if (req.method === "PATCH") {
      const cuerpo = await leerCuerpo(req);
      const cols = Object.keys(cuerpo);
      const set = cols.map((c, i) => `${ident(c)} = $${params.length + i + 1}`).join(", ");
      const filas = await comoRol(
        quien,
        async (tx) =>
          (
            await tx.query(
              `update public.${tabla} set ${set}${where} returning ${devolver ? select : "1"}`,
              [...params, ...Object.values(cuerpo)],
            )
          ).rows,
      );
      if (!devolver) return responder(res, 204);
      return responder(res, 200, objeto ? filas[0] : filas);
    }

    if (req.method === "DELETE") {
      const filas = await comoRol(
        quien,
        async (tx) =>
          (
            await tx.query(
              `delete from public.${tabla}${where} returning ${devolver ? select : "1"}`,
              params,
            )
          ).rows,
      );
      if (!devolver) return responder(res, 204);
      return responder(res, 200, objeto ? filas[0] : filas);
    }

    return responder(res, 405, { message: "Método no soportado" });
  } catch (e) {
    const codigo = e.code ?? "PGRST000";
    return responder(res, HTTP_POR_CODIGO[codigo] ?? 400, {
      code: codigo,
      message: e.message,
      details: e.detail ?? null,
      hint: e.hint ?? null,
    });
  }
}

// ─── Servidor ───────────────────────────────────────────────────────────────
createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return responder(res, 204);
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/auth/v1/")) return await manejarAuth(req, res, url);
    if (url.pathname.startsWith("/rest/v1/")) return await manejarRest(req, res, url);
    return responder(res, 404, {
      message: "No encontrado (el modo local no tiene Realtime ni Storage)",
    });
  } catch (e) {
    console.error(e);
    return responder(res, 500, { message: e.message });
  }
}).listen(PUERTO, "127.0.0.1", () => {
  console.log(`\n  Supabase local en http://127.0.0.1:${PUERTO}`);
  console.log("  Dueño:    barbero@faebarbershop.test / barbero123");
  console.log("  Empleado: empleado@faebarbershop.test / empleado123");
  console.log("  Admin:    admin@faebarbershop.test / admin123");
  console.log("  Cliente: 2346401122 / cliente123  ·  Primer ingreso: 2346409999 / nuevo1234\n");
});
