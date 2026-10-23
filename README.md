# FaeBarberShop · Club de beneficios

Web de fidelización para una barbería. Cada cliente tiene un **carnet digital** en el celular con un código QR y sellos: el barbero escanea el QR en cada corte, se estampa un sello y, al llegar a cada etapa de la tarjeta (por ejemplo, al 4.º corte 20% off, al 7.º 50% off y al 10.º corte gratis), el cliente gana un premio. Además, el carnet muestra descuentos en comercios amigos.

- **El barbero** da de alta a sus clientes, suma cortes (con un botón o escaneando el QR) anotando cuánto pagó cada cliente, y canjea premios.
- Hay dos tipos de barbero: **el dueño** ve todo (la caja con lo que cobró cada barbero, los montos de todos los cortes), edita precios, configura la regla de premios y los descuentos y puede borrar clientes; **el empleado** atiende (busca, escanea, da de alta, suma cortes, canjea premios) y solo ve los cortes que cargó él. Opcionalmente puede haber un **admin**: ve y configura todo como el dueño, pero no atiende (no tiene agenda ni aparece al sacar turno).
- **El cliente** entra con su teléfono y una contraseña, y ve su carnet, sus premios, los descuentos y su historial.
- **Turnos online:** cada barbero carga sus horarios; el cliente elige barbero, día y horario y reserva desde el celular. El barbero ve su agenda del día (se actualiza sola) y recibe una notificación cuando le reservan o le cancelan un turno.

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
13. [Actualizar una instalación que ya está funcionando](#13-actualizar-una-instalación-que-ya-está-funcionando)

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
   - [`supabase/migrations/20261022000100_barberos_y_precios.sql`](supabase/migrations/20261022000100_barberos_y_precios.sql)
   - [`supabase/migrations/20261023000100_premios_por_etapas.sql`](supabase/migrations/20261023000100_premios_por_etapas.sql)
   - [`supabase/migrations/20261023000200_turnos.sql`](supabase/migrations/20261023000200_turnos.sql)
   - [`supabase/migrations/20261024000100_admin.sql`](supabase/migrations/20261024000100_admin.sql) (siempre la **última**: va después de todas las anteriores)
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

El primer barbero es **el dueño** (el administrador) y se crea a mano una sola vez:

1. En Supabase, andá a **Authentication → Users → Add user → Create new user**.
2. Poné **tu email real** y una **contraseña** (de al menos 6 caracteres), tildá **Auto Confirm User** y tocá **Create user**.
3. Abrí **SQL Editor → New query** y pegá el contenido de [`supabase/crear-barbero.sql`](supabase/crear-barbero.sql).
4. Cambiá los dos valores marcados con 👉: **tu nombre** y **el email** que usaste en el paso 2.
5. Tocá **Run**. Al final tiene que aparecer una fila con `rol = barbero` y `es_dueno = true`.

Para entrar al panel: en la pantalla de ingreso tocá **"¿Sos el barbero? Entrá con tu email"**.

### 5.1 Sumar un barbero empleado

Cada barbero entra con su propio email y contraseña, así la app sabe quién hizo cada corte.

1. En Supabase, andá a **Authentication → Users → Add user → Create new user**.
2. Poné **el email del empleado** y una **contraseña** (de al menos 6 caracteres), tildá **Auto Confirm User** y tocá **Create user**.
3. Abrí **SQL Editor → New query** y pegá el contenido de [`supabase/crear-empleado.sql`](supabase/crear-empleado.sql) (ojo: **no** el de `crear-barbero.sql`, que crea un dueño).
4. Cambiá los dos valores marcados con 👉: **el nombre del empleado** (así va a aparecer en cada corte que cargue) y **el email** del paso 2.
5. Tocá **Run**. Al final tienen que aparecer dos filas: vos con `es_dueno = true` y el empleado con `es_dueno = false`.
6. Pasale al empleado su email y su contraseña. Entra igual que vos: **"¿Sos el barbero? Entrá con tu email"**. Si quiere, después la cambia desde **Cambiar contraseña** (arriba, en su nombre).

Qué puede hacer cada uno:

|                                                                       | Dueño      | Empleado                  |
| --------------------------------------------------------------------- | ---------- | ------------------------- |
| Buscar y escanear clientes, darlos de alta                            | ✅         | ✅                        |
| Sumar cortes (con el precio del cliente precargado) y canjear premios | ✅         | ✅                        |
| Deshacer un corte (dentro de los 10 minutos)                          | Cualquiera | Solo los suyos            |
| Ver el historial de cortes con montos                                 | De todos   | Solo los suyos            |
| Caja: totales por barbero y por período                               | ✅         | ❌                        |
| Editar el precio habitual de un cliente                               | ✅         | ❌ (lo ve, para cobrarlo) |
| Regla de premios, descuentos, borrar clientes                         | ✅         | ❌                        |

### 5.1.1 Cuenta de admin (opcional)

Si alguien tiene que **ver y configurar todo como el dueño pero no corta** (por ejemplo, quien mantiene la web), su cuenta se crea como dueño (paso 5) y después se convierte en **admin** con [`supabase/marcar-admin.sql`](supabase/marcar-admin.sql). El admin no aparece cuando los clientes sacan turno, no tiene horarios ni agenda propia y no recibe notificaciones; en la caja figura solo si suma algún corte (con la etiqueta "Admin"). Los pasos están en la sección [13](#perfil-admin-20261024000100_adminsql).

### 5.2 Si el empleado deja de trabajar

No lo borres (sus cortes quedarían "sin barbero"). Bloquealo: abrí **SQL Editor → New query**, pegá [`supabase/quitar-empleado.sql`](supabase/quitar-empleado.sql), cambiá el email marcado con 👉 y tocá **Run**. Sus cortes siguen en la caja con su nombre, pero ya no puede entrar.

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

   **Opcional, para las notificaciones de turnos** (ver [13 → Turnos online](#turnos-online-20261023000200_turnossql)): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. Sin ellas todo funciona igual, pero sin avisos.

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
5. **Barbero:** probá **Deshacer** (tenés 10 minutos), **Resetear contraseña** y **Canjear premio** cuando el cliente llegue a una etapa.

---

## 9. Personalizar la barbería

- **Nombre, slogan, ciudad, sedes, horarios, Instagram y WhatsApp de turnos:** en [`src/config/site.ts`](src/config/site.ts). Los campos vacíos no se muestran.
- **Regla de premios** (en qué cortes se gana un premio y cuál): desde el panel, en **Premios** (solo el dueño). Se pueden poner de 1 a 6 etapas, en tarjetas de hasta 30 cortes; la última completa la tarjeta, que vuelve a empezar. Arranca en "cada 5 cortes, 50% off en el siguiente corte" (una sola etapa).
- **Precio de cada cliente:** en su ficha, tocá **Precio** (solo el dueño). Se precarga cada vez que se le suma un corte; en ese momento se puede cambiar (por ejemplo, si ese día pagó otra cosa). También se puede cargar al darlo de alta.
- **Caja:** en el panel, **Caja** (solo el dueño). Muestra lo cobrado por cada barbero hoy, esta semana, este mes, el mes anterior o en el año, y la lista de cortes con su monto.
- **Descuentos asociados:** desde el panel, en **Descuentos**.
- **Colores, tipografías y sombras:** todos los tokens están definidos una sola vez en [`src/app/globals.css`](src/app/globals.css).

Después de cambiar archivos, subí los cambios a GitHub: Vercel publica la nueva versión solo.

---

## 10. Instalar el carnet en el celular

La web es una PWA: se puede "instalar" como una app, con ícono propio.

- **Android (Chrome):** menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).
- **iPhone (Safari):** botón **Compartir** → **Agregar a inicio**.

El ícono abre directo la pantalla de ingreso; si la sesión sigue abierta, va derecho al carnet (o, si es un barbero, a su **agenda**).

**Barberos:** instalen la web en su celular de la misma forma y, ya instalada, entren a **Agenda → Activar notificaciones**. En iPhone las notificaciones solo funcionan con la web agregada a inicio (iOS 16.4 o más nuevo); en Android funcionan también desde Chrome sin instalar.

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

| Rol                          | Usuario                                                 | Contraseña    |
| ---------------------------- | ------------------------------------------------------- | ------------- |
| Barbero dueño                | `barbero@faebarbershop.test` (tocá "¿Sos el barbero?")  | `barbero123`  |
| Barbero empleado             | `empleado@faebarbershop.test` (tocá "¿Sos el barbero?") | `empleado123` |
| Admin (ve todo, no atiende)  | `admin@faebarbershop.test` (tocá "¿Sos el barbero?")    | `admin123`    |
| Cliente                      | `2346401122`                                            | `cliente123`  |
| Cliente en su primer ingreso | `2346409999`                                            | `nuevo1234`   |

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
  crear-barbero.sql     Alta del barbero dueño
  crear-empleado.sql    Alta de un barbero empleado
  quitar-empleado.sql   Bloquear a un empleado que ya no trabaja
  tests/                Tests de base de datos (PGlite)
scripts/                Emulador local y copia del lector de QR
```

### Seguridad (resumen)

- **RLS activado en todas las tablas** y permisos mínimos por rol (`anon`, `authenticated`). Un cliente solo puede **leer** sus propios datos, la regla activa y los descuentos vigentes. No puede escribir nada.
- El rol se chequea con `es_barbero()` y `es_dueno()` (`security definer`, `search_path` fijo).
- **Dueño y empleado:** el RLS de `cortes` deja que el empleado lea solo los cortes que cargó él (con su monto); la tarjeta de sellos igual cuenta todos, con una función que devuelve solo cantidades. `facturacion()`, `guardar_precio_cliente()` y `guardar_regla()` exigen ser dueño; `deshacer_corte()` deja al empleado deshacer solo los suyos; escribir descuentos también es solo del dueño. Además, `proxy.ts` y los guards (`requireDueno`) lo sacan de las secciones del dueño, y las Server Actions lo vuelven a verificar.
- Cortes, canjes y reglas se escriben **solo** mediante funciones SQL que validan las reglas de negocio de forma atómica: el canje bloquea la fila del cliente y recalcula los premios disponibles de la etapa elegida; cada acción lleva una clave de idempotencia, así un doble toque no duplica nada. Las etapas de la regla se validan en la base (1 a 6, cortes distintos del 1 al 30) y solo el dueño las puede guardar (`guardar_regla_etapas`).
- Crear, editar, resetear y eliminar usuarios se hace solo en el servidor con la clave secreta, siempre después de verificar que quien llama es el barbero. La clave nunca llega al navegador (`server-only`).
- `proxy.ts` redirige según el rol, y además cada página y cada acción vuelve a verificar la sesión en el servidor.
- Los tests (`npm run test:db`) prueban que un cliente no puede leer datos de otro, ni escribir, ni sumarse cortes, ni canjear premios; que el empleado no ve montos ni cortes del otro barbero ni puede usar las funciones del dueño; y que la migración nueva funciona sobre una base con datos.

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

---

## 13. Actualizar una instalación que ya está funcionando

Cuando el código trae una **migración nueva** (un archivo nuevo en `supabase/migrations/`), hay que aplicarla en Supabase **antes** de publicar el código nuevo. La migración nueva funciona con la versión anterior de la app, pero la app nueva necesita la migración.

### Perfil admin (`20261024000100_admin.sql`)

Qué hace: separa la cuenta que **supervisa** de la que **atiende**. Hoy la única cuenta "dueño" es la del desarrollador, que no corta. Con esta actualización:

- La cuenta del desarrollador pasa a ser **admin**: sigue viendo y configurando todo (caja, montos, las dos agendas, precios, premios, descuentos, horarios de los barberos, borrar clientes) y puede escanear y sumar cortes (quedan a su nombre), pero **no aparece cuando un cliente saca turno**, no tiene horarios ni agenda propia, no recibe notificaciones y en la caja figura solo si cargó algún corte (con la etiqueta "Admin").
- El **dueño real** de la barbería tiene su propia cuenta de dueño: corta, tiene su agenda y sus horarios, y ve todo.
- El empleado sigue exactamente igual.

La migración **no convierte a nadie en admin** ni cambia datos: hasta el paso 4, todos ven lo mismo de siempre. La versión publicada de la app sigue funcionando con la base migrada.

**Orden exacto:** migración → código → marcar admin → cuenta del dueño real.

1. **(Recomendado) Hacé un respaldo** (Database → Backups), como en las actualizaciones anteriores.
2. **Migración.** Abrí **SQL Editor → New query**, pegá **todo** el contenido de [`supabase/migrations/20261024000100_admin.sql`](supabase/migrations/20261024000100_admin.sql) y tocá **Run**. Tiene que decir _Success_. Correlo **una sola vez** (si lo corrés de nuevo da error porque la restricción ya existe; no rompe nada). Verificá en una consulta nueva:

   ```sql
   select nombre, es_dueno, es_admin from perfiles where rol = 'barbero';
   ```

   Tienen que aparecer tus barberos de siempre, **todos con `es_admin = false`**.

3. **Publicá el código nuevo** (merge a `main`; Vercel publica solo en un par de minutos). **No lo publiques antes del paso 2**: la app nueva lee la columna `es_admin` y, sin ella, nadie podría entrar al panel.
4. **Marcá la cuenta del desarrollador como admin.** Si esa cuenta tiene turnos de clientes reservados de hoy en adelante, primero cancelalos desde **Agenda** (el script te avisa y no cambia nada si quedó alguno). Después abrí **SQL Editor → New query**, pegá [`supabase/marcar-admin.sql`](supabase/marcar-admin.sql), cambiá el email marcado con 👉 por **el email con el que entra el desarrollador** y tocá **Run**. Al final tiene que aparecer esa cuenta con `es_admin = true`. Se puede correr más de una vez. Borra el horario de esa cuenta (ya no atiende) y apaga sus notificaciones; sus cortes no se tocan.
5. **Creá la cuenta del dueño real** (el que corta), como dueño que atiende:
   1. En Supabase, **Authentication → Users → Add user → Create new user**: **el email del dueño** y una **contraseña** (al menos 6 caracteres), tildá **Auto Confirm User** y tocá **Create user**.
   2. **SQL Editor → New query**, pegá [`supabase/crear-barbero.sql`](supabase/crear-barbero.sql), cambiá los dos valores marcados con 👉 (**el nombre del dueño**, así lo ven los clientes al sacar turno, y **su email**) y tocá **Run**. Al final tiene que aparecer su fila con `es_dueno = true` y `es_admin = false` (y aparte la del admin, con `es_admin = true`).
   3. Pasale su email y su contraseña. Entra con **"¿Sos el barbero? Entrá con tu email"** (después la puede cambiar desde **Cambiar contraseña**).
6. **Horarios del dueño.** Él (o el admin, desde **Agenda → Horarios** eligiendo su nombre) carga sus horarios. Hasta que tenga horarios no aparece para los clientes. Que active las notificaciones en su celular (**Agenda → Activar notificaciones**), como en el paso 8 de "Turnos online".
7. Probalo: entrando como admin, la **Agenda** muestra **Dueño | Empleado | Ambos** (sin "Vos") y **Horarios** pregunta de quién; con un cliente, **Sacá turno** muestra solo a los barberos que atienden.

> Para deshacerlo (que la cuenta vuelva a ser un dueño que atiende), el final de `marcar-admin.sql` trae la consulta.

### Premios por etapas (`20261023000100_premios_por_etapas.sql`)

Qué hace: permite que la regla de premios tenga **varias etapas** (por ejemplo, al 4.º corte 20% off, al 7.º 50% off y al 10.º corte gratis) y que al canjear se elija **cuál** premio. La regla que tenés hoy ("cada N cortes, un premio") pasa a ser una regla de **una sola etapa**: **ningún cliente cambia sus sellos ni sus premios disponibles**, y no se borra nada. La versión de la app que está publicada sigue funcionando igual con la base migrada, así que no hay apuro entre el paso 2 y el 4.

> Si todavía no aplicaste `20261022000100_barberos_y_precios.sql`, primero seguí la sección de abajo ("Dueño y empleado…") y después volvé acá.

1. **(Recomendado) Hacé un respaldo**, igual que en la sección de abajo (Database → Backups, o exportá `reglas` y `canjes` a CSV desde Table Editor).
2. Abrí **SQL Editor → New query**, pegá **todo** el contenido de [`supabase/migrations/20261023000100_premios_por_etapas.sql`](supabase/migrations/20261023000100_premios_por_etapas.sql) y tocá **Run**. Tiene que decir _Success_. Correlo **una sola vez** (si lo corrés de nuevo da error porque las restricciones ya existen; no rompe nada).
3. Verificá: en una consulta nueva pegá y corré

   ```sql
   select cortes_necesarios, descripcion_premio, etapas from reglas where activa;
   ```

   Tiene que aparecer tu regla de siempre y, en `etapas`, la misma regla como una sola etapa (por ejemplo `[{"corte": 5, "descripcion": "50% off en el siguiente corte"}]`).

4. **Publicá el código nuevo:** subí los cambios a GitHub (o hacé el merge a `main`). Vercel publica solo en un par de minutos. **No publiques el código antes del paso 2**: la app nueva necesita las columnas que agrega la migración.
5. Entrá al panel como dueño → **Premios** y armá las etapas (corte n.º y premio de cada una). La vista previa muestra cómo se va a ver el carnet. Al guardar, todos los clientes ven la regla nueva.

   > Al cambiar la regla, los premios de cada cliente se recalculan con todo su historial (como pasaba antes). Los premios ya canjeados no se tocan y nadie queda con premios en negativo; algunos clientes pueden ganar un premio en el momento o tener que esperar un poco más. Los detalles están en [`DECISIONES.md`](DECISIONES.md#premios-por-etapas-migración-20261023000100).

### Dueño y empleado, precios y montos (`20261022000100_barberos_y_precios.sql`)

Qué hace: agrega el precio habitual de cada cliente, el monto de cada corte, y separa al barbero **dueño** del **empleado**. No borra ni cambia datos: los cortes de antes quedan como "Sin monto" y siguen contando para los sellos, y **el barbero que ya existe pasa a ser el dueño**.

1. **(Recomendado) Hacé un respaldo.** En Supabase, **Database → Backups**: fijate que haya un respaldo de hoy (el plan gratuito hace uno por día). Si querés uno al momento, podés exportar las tablas desde **Table Editor → (tabla) → Export → CSV**.
2. Abrí **SQL Editor → New query**, pegá **todo** el contenido de [`supabase/migrations/20261022000100_barberos_y_precios.sql`](supabase/migrations/20261022000100_barberos_y_precios.sql) y tocá **Run**. Tiene que decir _Success_. Correlo **una sola vez** (si lo corrés de nuevo, da error porque las columnas ya existen; no rompe nada).
3. Verificá que quedaste como dueño: en una consulta nueva pegá y corré

   ```sql
   select nombre, rol, es_dueno from perfiles where rol = 'barbero';
   ```

   Tiene que aparecer tu nombre con `es_dueno = true`.

4. **Publicá el código nuevo:** subí los cambios a GitHub (o hacé el merge a `main`). Vercel publica solo en un par de minutos.
5. Entrá al panel: vas a ver **Caja** en el menú y el campo **Cobrás** al sumar un corte.
6. Cargá el **precio habitual** de tus clientes de siempre (ficha del cliente → **Precio**). Mientras no tengan precio, el campo **Cobrás** aparece vacío y se escribe a mano.
7. Sumá al empleado siguiendo el paso [5.1](#51-sumar-un-barbero-empleado).

<details>
<summary>Alternativa con la línea de comandos (opcional)</summary>

```bash
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push        # aplica solo las migraciones que falten
```

Usalo **solo** si las migraciones anteriores también se aplicaron con `db push`. Si las pegaste en el SQL Editor (como dice el paso 3), `db push` no sabe que ya están e intenta crearlas de nuevo: en ese caso seguí los pasos de arriba.

</details>

### Turnos online (`20261023000200_turnos.sql`)

Qué hace: suma los **turnos online**. Agrega tablas nuevas (horarios de cada barbero, días especiales, turnos y suscripciones a notificaciones), las funciones que reservan y cancelan, y un aviso automático que marca el turno como "atendido" cuando le sumás el corte al cliente. **No cambia ni borra datos** y la versión anterior de la app sigue funcionando igual. Tiene que ir **después** de todas las migraciones anteriores (incluida la de premios por etapas, si vino en la misma actualización).

**Orden:** primero la base, después las claves de notificaciones y por último el código.

1. **(Recomendado) Hacé un respaldo** (Database → Backups), como en la actualización anterior.
2. Si en esta misma actualización vino otra migración con fecha anterior (por ejemplo, la de premios por etapas), aplicala **primero**.
3. Abrí **SQL Editor → New query**, pegá **todo** el contenido de [`supabase/migrations/20261023000200_turnos.sql`](supabase/migrations/20261023000200_turnos.sql) y tocá **Run**. Tiene que decir _Success_. Correlo **una sola vez**.
4. Verificá en una consulta nueva:

   ```sql
   select count(*) from turnos;                                   -- 0
   select extname from pg_extension where extname = 'btree_gist'; -- btree_gist
   ```

5. **Claves de las notificaciones (VAPID).** Se generan **una sola vez** en tu computadora:

   ```bash
   npx web-push generate-vapid-keys
   ```

   Te muestra una **Public Key** y una **Private Key**. En Vercel, **Settings → Environment Variables**, cargá (para _Production_ y _Preview_):

   | Nombre                         | Valor                                                     |
   | ------------------------------ | --------------------------------------------------------- |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | La **Public Key**                                         |
   | `VAPID_PRIVATE_KEY`            | La **Private Key** (⚠️ secreta: nunca con `NEXT_PUBLIC_`) |
   | `VAPID_SUBJECT`                | `mailto:` + tu email (por ejemplo `mailto:fae@gmail.com`) |

   No las cambies después: si cambian, cada barbero tiene que volver a tocar **Activar notificaciones**. Si no las cargás, la app funciona igual pero sin avisos.

6. **Publicá el código nuevo** (merge a `main`). Si cargaste las claves después del deploy, hacé **Deployments → ⋯ → Redeploy**.
7. **Cargá los horarios.** Cada barbero entra a **Agenda → Horarios** (el empleado también lo tiene en la barra de abajo): por día, **Agregar franja** (desde, hasta y turnos de 30 o 60 minutos) y **Copiar a otros días**. Guardá. El dueño puede cargar o corregir los del empleado con el selector **Vos | Nombre**. Un barbero sin horarios no aparece para los clientes.
8. **Activá las notificaciones** en el celular de cada barbero: instalá la web (paso [10](#10-instalar-el-carnet-en-el-celular)), abrila desde el ícono, entrá a **Agenda** y tocá **Activar notificaciones** → **Permitir**. En iPhone, primero agregala a inicio (Compartir → Agregar a inicio) y abrila desde ahí.
9. Probalo: con un cliente de prueba, en el carnet tocá **Sacá turno**, elegí barbero, día y horario, y confirmá. El turno aparece en la agenda y al barbero le llega el aviso. Cancelalo desde el carnet.

Reglas de los turnos: se reservan con **al menos 1 hora** de anticipación y **hasta 14 días** adelante; **1 turno a la vez** por cliente; el cliente cancela desde la web **hasta 3 horas antes** (después, le aparece el botón de WhatsApp). El barbero, desde la agenda, puede cancelar, escribir por WhatsApp, **reservar para un cliente** (por ejemplo, alguien que llamó) y **bloquear** un horario.

> Si un empleado deja de trabajar, [`supabase/quitar-empleado.sql`](supabase/quitar-empleado.sql) ahora también borra su horario, así deja de ofrecerse. Sus turnos ya reservados no se borran: revisalos en la agenda.
