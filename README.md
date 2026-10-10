# FaeBarberShop · Club de beneficios

Web de fidelización para una barbería. Cada cliente tiene un **carnet digital** en el celular con un código QR y sellos: el barbero escanea el QR en cada corte, se estampa un sello y, al completar la tarjeta, el cliente gana un premio. Además, el carnet muestra descuentos en comercios amigos.

- **El barbero** da de alta a sus clientes, suma cortes (con un botón o escaneando el QR), canjea premios, configura la regla de premios y administra los descuentos asociados.
- **El cliente** entra con su teléfono y una contraseña, y ve su carnet, sus premios, los descuentos y su historial.

Todo funciona dentro de los planes gratuitos de **Supabase** (base de datos y usuarios) y **Vercel** (hosting). No se envían mails: el barbero le pasa los datos de acceso al cliente en persona o por WhatsApp.

---

## Índice

1. [Qué vas a necesitar](#1-qué-vas-a-necesitar)
2. [Crear el proyecto en Supabase](#2-crear-el-proyecto-en-supabase)
3. [Crear las tablas (migraciones)](#3-crear-las-tablas-migraciones)
4. [Configurar el login en Supabase](#4-configurar-el-login-en-supabase)
5. [Crear el primer barbero](#5-crear-el-primer-barbero)
6. [Publicar la app en Vercel](#6-publicar-la-app-en-vercel)
7. [Agregar el dominio de Vercel en Supabase](#7-agregar-el-dominio-de-vercel-en-supabase)
8. [Probar que todo funcione](#8-probar-que-todo-funcione)
9. [Personalizar la barbería](#9-personalizar-la-barbería)
10. [Instalar el carnet en el celular](#10-instalar-el-carnet-en-el-celular)
11. [Para desarrolladores](#11-para-desarrolladores)
12. [Problemas frecuentes](#12-problemas-frecuentes)

---

## 1. Qué vas a necesitar

Tres cuentas gratuitas:

| Servicio     | Para qué                 | Dónde                                                            |
| ------------ | ------------------------ | ---------------------------------------------------------------- |
| **GitHub**   | Guardar el código        | [github.com](https://github.com)                                 |
| **Supabase** | Base de datos y usuarios | [supabase.com](https://supabase.com)                             |
| **Vercel**   | Publicar la web          | [vercel.com](https://vercel.com) (entrá con tu cuenta de GitHub) |

Y este proyecto subido a un repositorio de GitHub (si no sabés cómo: en GitHub tocá **New repository**, creálo vacío y seguí las instrucciones de "push an existing repository").

> 💡 Mientras sigas los pasos, tené abierto un bloc de notas para ir guardando la **URL** y las **claves** de Supabase.

---

## 2. Crear el proyecto en Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard) y tocá **New project**.
2. Completá:
   - **Name:** por ejemplo `barberia`.
   - **Database Password:** tocá **Generate a password** y guardala (no la vas a necesitar seguido, pero no la pierdas).
   - **Region:** elegí **South America (São Paulo)**, la más cercana a Argentina.
3. Tocá **Create new project** y esperá uno o dos minutos a que termine.
4. Guardá estos tres datos (están en **Project Settings → API Keys** y en el botón **Connect** de arriba):
   - **Project URL**: algo como `https://abcdefgh.supabase.co`.
   - **Publishable key** (empieza con `sb_publishable_…`). En proyectos viejos se llama **anon key**.
   - **Secret key** (empieza con `sb_secret_…`; tocá **Reveal** para verla). En proyectos viejos se llama **service_role key**.

> ⚠️ La **secret key** da acceso total a la base de datos. No la compartas ni la subas a GitHub. Solo se carga en Vercel (paso 6).

---

## 3. Crear las tablas (migraciones)

1. En Supabase, abrí **SQL Editor** (menú de la izquierda) y tocá **New query**.
2. Abrí el archivo [`supabase/migrations/20261010000100_tablas.sql`](supabase/migrations/20261010000100_tablas.sql), copiá **todo** su contenido, pegalo en el editor y tocá **Run**. Tiene que decir _Success_.
3. Repetí lo mismo, **en este orden**, con:
   - [`supabase/migrations/20261010000200_funciones.sql`](supabase/migrations/20261010000200_funciones.sql)
   - [`supabase/migrations/20261010000300_seguridad.sql`](supabase/migrations/20261010000300_seguridad.sql)
4. Para verificar: en **Table Editor** tienen que aparecer las tablas `perfiles`, `cortes`, `canjes`, `reglas` y `descuentos_asociados`, todas con el candado de **RLS enabled**.

<details>
<summary>Alternativa con la línea de comandos (opcional)</summary>

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF   # el código que aparece en la URL del proyecto
npx supabase db push                              # aplica todo lo que hay en supabase/migrations
```

</details>

> **Datos de ejemplo:** el archivo [`supabase/seed.sql`](supabase/seed.sql) carga clientes, cortes y descuentos ficticios para probar. Usalo solo en un proyecto de prueba, **nunca en el de producción** (crea usuarios con contraseñas conocidas).

---

## 4. Configurar el login en Supabase

Los clientes entran con teléfono y contraseña. Por dentro, Supabase usa un email interno (que el cliente nunca ve) y **no se manda ningún mail**. Para eso:

1. Andá a **Authentication → Sign In / Providers** (en algunas versiones: **Authentication → Providers → Email**).
2. En **Email**, **desactivá "Confirm email"** y guardá. Esto es obligatorio: si queda activado, los clientes no van a poder entrar.
3. En la misma pantalla, en **User Signups**, **desactivá "Allow new users to sign up"** y guardá. Los clientes los crea el barbero desde el panel; nadie tiene que poder registrarse solo.
   > ⚠️ Desactivá solo esa opción general. **No desactives el proveedor "Email"**: si lo apagás, nadie (ni el barbero ni los clientes) puede entrar con contraseña.
4. Dejá desactivada la opción **"Secure password change"** (viene así por defecto).

> Las sesiones duran mucho: el cliente no tiene que volver a loguearse seguido. No hace falta configurar nada para eso.

---

## 5. Crear el primer barbero

El barbero (el administrador) se crea a mano una sola vez:

1. En Supabase, andá a **Authentication → Users → Add user → Create new user**.
2. Poné **tu email real** y una **contraseña** (de al menos 6 caracteres), tildá **Auto Confirm User** y tocá **Create user**.
3. Abrí **SQL Editor → New query** y pegá el contenido de [`supabase/crear-barbero.sql`](supabase/crear-barbero.sql).
4. Cambiá los dos valores marcados con 👉: **tu nombre** y **el email** que usaste en el paso 2.
5. Tocá **Run**. Al final tiene que aparecer una fila con `rol = barbero`.

Para entrar al panel: en la pantalla de ingreso tocá **"¿Sos el barbero? Entrá con tu email"**.

---

## 6. Publicar la app en Vercel

1. Entrá a [vercel.com/new](https://vercel.com/new) e **importá** el repositorio de GitHub del proyecto.
2. Vercel detecta que es Next.js. No cambies nada de _Build Settings_.
3. Abrí **Environment Variables** y cargá estas variables (los valores son los del paso 2):

   | Nombre                                 | Valor                                                                                 |
   | -------------------------------------- | ------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | La **Project URL** de Supabase                                                        |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La **publishable key** (o la anon key)                                                |
   | `SUPABASE_SERVICE_ROLE_KEY`            | La **secret key** (o la service_role key)                                             |
   | `NEXT_PUBLIC_SITE_URL`                 | La dirección de tu web, por ejemplo `https://fae-ten.vercel.app` (sin barra al final) |

   Si todavía no sabés la dirección final, dejá `NEXT_PUBLIC_SITE_URL` para después del primer deploy (paso 5 de esta lista).

4. Tocá **Deploy** y esperá a que termine (un par de minutos).
5. Copiá la dirección que te da Vercel (por ejemplo `https://fae-ten.vercel.app`). Si no habías cargado `NEXT_PUBLIC_SITE_URL`, cargala ahora en **Settings → Environment Variables** y hacé **Deployments → ⋯ → Redeploy**.

> `NEXT_PUBLIC_SITE_URL` es importante: es la dirección que va dentro del QR de cada carnet y en los mensajes de WhatsApp.

---

## 7. Agregar el dominio de Vercel en Supabase

1. En Supabase, andá a **Authentication → URL Configuration**.
2. En **Site URL** poné la dirección de Vercel (por ejemplo `https://fae-ten.vercel.app`).
3. En **Redirect URLs** tocá **Add URL** y agregá `https://fae-ten.vercel.app/**` (con tu dirección).
4. Guardá. Si más adelante usás un dominio propio (por ejemplo `carnet.faebarbershop.com.ar`), agregalo también acá y actualizá `NEXT_PUBLIC_SITE_URL` en Vercel.

---

## 8. Probar que todo funcione

Hacé este recorrido completo una vez (con tu celular y otro dispositivo, o con dos navegadores):

1. **Barbero:** entrá con tu email → **Nuevo cliente** → cargá un nombre y tu propio celular → **Crear cliente**. Aparece una tarjeta con el teléfono y la contraseña, y los botones **Copiar** y **Enviar por WhatsApp**.
2. **Cliente:** en otro navegador entrá con ese teléfono y esa contraseña. Te pide elegir una contraseña nueva. Después ves el carnet.
3. **Barbero:** tocá **Escanear** y apuntá al QR del carnet (tocá **Mostrar mi QR** en el carnet). Confirmá **Sumar corte**.
4. **Cliente:** el sello aparece en el carnet (en vivo, o al volver a abrirlo).
5. **Barbero:** probá **Deshacer** (tenés 10 minutos), **Resetear contraseña** y **Canjear premio** cuando el cliente complete la tarjeta.

---

## 9. Personalizar la barbería

- **Nombre, slogan, ciudad, sedes, horarios, Instagram y WhatsApp de turnos:** en [`src/config/site.ts`](src/config/site.ts). Los campos vacíos no se muestran.
- **Regla de premios** (cada cuántos cortes y qué premio): desde el panel, en **Premios**. Arranca en "cada 5 cortes, 50% off en el siguiente corte".
- **Descuentos asociados:** desde el panel, en **Descuentos**.
- **Colores, tipografías y sombras:** todos los tokens están definidos una sola vez en [`src/app/globals.css`](src/app/globals.css).

Después de cambiar archivos, subí los cambios a GitHub: Vercel publica la nueva versión solo.

---

## 10. Instalar el carnet en el celular

La web es una PWA: se puede "instalar" como una app, con ícono propio.

- **Android (Chrome):** menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).
- **iPhone (Safari):** botón **Compartir** → **Agregar a inicio**.

El ícono abre directo la pantalla de ingreso; si la sesión sigue abierta, va derecho al carnet.

---

## 11. Para desarrolladores

### Stack

Next.js 16 (App Router) · TypeScript estricto · Tailwind CSS 4 · shadcn/ui (Radix) · lucide-react · framer-motion · Supabase (Postgres + Auth + Realtime) con `@supabase/ssr` · zod · `qrcode` (generar) · `@yudiel/react-qr-scanner` (escanear) · Vitest · PGlite.

### Correr en tu computadora

Requisitos: Node.js 20.9 o superior.

```bash
npm install
cp .env.example .env.local     # y completá los valores
npm run dev                     # http://localhost:3000
```

**Sin cuenta de Supabase ni Docker:** el proyecto trae un emulador mínimo de Supabase sobre PGlite, con las migraciones, el seed y el RLS reales (no tiene Realtime).

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-anon-key
SUPABASE_SERVICE_ROLE_KEY=local-service-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```bash
npm run supabase:local    # en una terminal
npm run dev               # en otra
```

Usuarios de ejemplo (del seed):

| Rol                          | Usuario                                                | Contraseña   |
| ---------------------------- | ------------------------------------------------------ | ------------ |
| Barbero                      | `barbero@faebarbershop.test` (tocá "¿Sos el barbero?") | `barbero123` |
| Cliente                      | `2346401122`                                           | `cliente123` |
| Cliente en su primer ingreso | `2346409999`                                           | `nuevo1234`  |

### Scripts

| Comando                  | Qué hace                                                       |
| ------------------------ | -------------------------------------------------------------- |
| `npm run dev`            | Servidor de desarrollo                                         |
| `npm run build`          | Build de producción                                            |
| `npm run lint`           | ESLint (sin warnings permitidos)                               |
| `npm run typecheck`      | Chequeo de TypeScript                                          |
| `npm test`               | Todos los tests (unitarios + base de datos)                    |
| `npm run test:db`        | Tests de migraciones, RLS y funciones SQL (PGlite, sin Docker) |
| `npm run check`          | typecheck + lint + tests                                       |
| `npm run format`         | Prettier                                                       |
| `npm run supabase:local` | Emulador de Supabase para desarrollo                           |

### Estructura

```
src/
  app/                  Rutas (App Router)
    page.tsx            Landing
    login/              Ingreso (Server Action)
    cambiar-password/   Cambio de contraseña (obligatorio o voluntario)
    carnet/             Carnet del cliente
    panel/              Panel del barbero (dashboard, clientes, escanear, descuentos, premios)
  components/
    ui/                 Componentes base de shadcn/ui (ajustados a la marca)
    comunes/            Formularios, estados vacíos, confirmaciones, etc.
    carnet/             Tarjeta, sellos, celebración, Realtime
    panel/              Componentes del panel
    marca/              Logo y poste de barbero
  lib/
    supabase/           Clientes de Supabase (navegador, servidor, admin) y proxy
    datos/              Consultas (server-only)
    auth.ts             Sesión y guards (requireBarbero / requireCliente)
    validaciones.ts     Esquemas zod compartidos
  config/site.ts        Identidad de la barbería
  proxy.ts              Protección de rutas y refresco de sesión
supabase/
  migrations/           Tablas, funciones, vista, RLS
  seed.sql              Datos de ejemplo
  crear-barbero.sql     Alta del primer barbero
  tests/                Tests de base de datos (PGlite)
scripts/                Emulador local y copia del lector de QR
```

### Seguridad (resumen)

- **RLS activado en todas las tablas** y permisos mínimos por rol (`anon`, `authenticated`). Un cliente solo puede **leer** sus propios datos, la regla activa y los descuentos vigentes. No puede escribir nada.
- El rol se chequea con `es_barbero()` (`security definer`, `search_path` fijo).
- Cortes, canjes y reglas se escriben **solo** mediante funciones SQL que validan las reglas de negocio de forma atómica: el canje bloquea la fila del cliente y recalcula los premios disponibles; cada acción lleva una clave de idempotencia, así un doble toque no duplica nada.
- Crear, editar, resetear y eliminar usuarios se hace solo en el servidor con la clave secreta, siempre después de verificar que quien llama es el barbero. La clave nunca llega al navegador (`server-only`).
- `proxy.ts` redirige según el rol, y además cada página y cada acción vuelve a verificar la sesión en el servidor.
- Los tests (`npm run test:db`) prueban que un cliente no puede leer datos de otro, ni escribir, ni sumarse cortes, ni canjear premios.

Las decisiones de diseño están en [`DECISIONES.md`](DECISIONES.md) y el plan de trabajo en [`PLAN.md`](PLAN.md).

### Tipos de la base

[`src/lib/database.types.ts`](src/lib/database.types.ts) está escrito a mano con el formato de Supabase. Si cambiás las migraciones, podés regenerarlo:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_REF > src/lib/database.types.ts
```

---

## 12. Problemas frecuentes

**"Teléfono o contraseña incorrectos" con datos correctos.**
Revisá que **"Confirm email"** esté desactivado (paso 4). Si el cliente se creó cuando estaba activado, reseteale la contraseña desde su ficha.

**El panel dice que falta una variable de entorno o la página da error.**
Revisá las cuatro variables en Vercel (paso 6) y hacé **Redeploy**. Los nombres tienen que ser exactamente los de la tabla.

**El QR lleva a una dirección vieja o a `localhost`.**
Corregí `NEXT_PUBLIC_SITE_URL` en Vercel y hacé **Redeploy**. Los carnets se regeneran solos.

**La cámara no abre al escanear.**
El navegador tiene que tener permiso de cámara para el sitio (candado al lado de la dirección → Permisos). Funciona solo con `https` (Vercel ya lo da). Si no hay caso, usá **Buscar al cliente a mano**.

**Un cliente se olvidó la contraseña.**
Buscalo en **Clientes** → **Resetear contraseña** → pasale la temporal por WhatsApp. Al entrar, va a elegir una nueva.

**El proyecto de Supabase aparece "pausado".**
En el plan gratuito, Supabase pausa los proyectos que pasan **una semana sin uso**. Con el uso diario de la barbería no pasa; si ocurre, entrá al dashboard de Supabase y tocá **Restore project**.
