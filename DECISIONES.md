# Decisiones tomadas

Registro de las decisiones que no estaban definidas en el pedido, con el motivo de cada una.

## Stack y herramientas

- **Next.js 16.4 (última estable).** En esta versión `middleware.ts` pasó a llamarse `proxy.ts`; se usa la convención nueva.
- **Escáner de QR: `@yudiel/react-qr-scanner`** en lugar de `html5-qrcode`. `html5-qrcode` no recibe actualizaciones desde 2023; la alternativa elegida está mantenida, usa la API nativa `BarcodeDetector` cuando existe y un polyfill WebAssembly (ZXing) cuando no (iPhone).
- **shadcn/ui con base Radix** (preset "nova"), adaptado a la estética oscura de la marca.
- **Tests de base de datos con PGlite** (Postgres embebido en Node). Permite probar migraciones, RLS y funciones sin Docker ni un proyecto de Supabase. Se agregan stubs mínimos de lo que Supabase provee (`auth.uid()`, roles `anon`/`authenticated`, publicación de Realtime). PGlite tiene una sola conexión, así que la concurrencia real del canje se garantiza con `SELECT ... FOR UPDATE` + clave de idempotencia y se prueba de forma secuencial.
- **Vitest** para tests unitarios (normalización de teléfono, armado del link de WhatsApp, esquemas zod) y para los tests de base.

## Marca

- La barbería se llama **FaeBarberShop** (al principio se usó "La Navaja" como nombre provisorio). Se cambia en un solo lugar: `src/config/site.ts` (nombre, ciudad, sedes, Instagram, WhatsApp). Ciudad, sedes, Instagram y WhatsApp de turnos se tomaron del perfil @faebarbershop: La Plata, calle 16 e/ 40 y 41 y calle 45 e/ 28 y 29.

## Login

- **El usuario del cliente es el teléfono normalizado a solo dígitos.** Supabase Auth necesita un email, así que se genera `{telefono}@clientes.local` (dominio configurable con `CLIENTES_EMAIL_DOMAIN`). El cliente nunca lo ve.
- **El barbero entra con email.** En `/login` el campo por defecto es "Teléfono"; un enlace discreto "¿Sos el barbero? Entrá con tu email" cambia el campo a email. Así el cliente ve solo teléfono y contraseña, y el barbero no necesita un teléfono.
- **El login se hace con una Server Action**: la conversión teléfono → email interno ocurre en el servidor.
- **Cambio voluntario de contraseña pide la contraseña actual** (buena práctica). El cambio obligatorio (primer ingreso / reseteo) no la pide, porque el usuario acaba de ingresarla.
- **Sesión persistente**: `@supabase/ssr` guarda la sesión en cookies de larga duración y el `proxy` la refresca en cada request. No se configura vencimiento de sesión.
- **Registro público desactivado**: en Supabase hay que apagar "Allow new users to sign up" (ver README). Aunque alguien se registrara, sin fila en `perfiles` no tendría acceso a nada (RLS + guards).

## Teléfono y WhatsApp

- Se guarda solo con dígitos, entre 8 y 15. En el alta se sugiere cargarlo **con código de área, sin 0 ni 15** (ej.: `2346 123456`).
- Para el botón "Enviar por WhatsApp" (`wa.me`) el número se convierte a formato internacional argentino (`549` + 10 dígitos) cuando es posible. Si el número no tiene un formato reconocible, el link abre WhatsApp sin destinatario y con el mensaje armado, para que el barbero elija el contacto.

## Reglas de negocio

- **Sellos y premios** siguen la fórmula pedida: `sellos = cortes % N` y `premios disponibles = floor(cortes / N) - canjes` (nunca menor a 0). Si la regla cambia, se recalcula sobre todo el historial.
- **Visualmente**, cuando el cliente tiene un premio para canjear y su cantidad de cortes es múltiplo exacto de N, la tarjeta muestra los N sellos completos ("¡Premio listo!") en lugar de 0/N; al canjear, la tarjeta vuelve a 0/N.
- **La regla tiene historial**: guardar una regla nueva desactiva la anterior en la misma transacción (`guardar_regla`). Cada canje guarda la descripción del premio vigente en ese momento.
- **Cortes y canjes solo se escriben por funciones SQL** (`registrar_corte`, `deshacer_corte`, `canjear_premio`) con `security definer` y chequeo de `es_barbero()`. No hay policies de INSERT/DELETE directas, así las reglas (10 minutos, premios disponibles) no se pueden saltear desde la API.
- **Anti doble toque**:
  - Cada acción del panel manda una clave de idempotencia (`solicitud_id`) única por intento; si llega repetida se devuelve el registro ya creado, sin duplicar.
  - `canjear_premio` bloquea la fila del cliente (`FOR UPDATE`) y recalcula los disponibles dentro de la transacción.
  - `registrar_corte` rechaza un segundo corte al mismo cliente dentro de los 60 segundos (cubre el caso de escanear dos veces el mismo QR).
- **Deshacer un corte**: solo dentro de los 10 minutos y solo si no deja al cliente con más canjes que premios ganados (si ya se canjeó el premio que ese corte completó, se rechaza con un mensaje claro).
- **Eliminar cliente**: no estaba pedido, pero se agregó (con confirmación escribiendo el nombre) porque es necesario para dar de baja cuentas de prueba o duplicadas. Borra su usuario y, en cascada, su historial.
- **Editar el teléfono de un cliente** también cambia su email interno en Supabase Auth (Server Action con service role), así puede seguir entrando con el teléfono nuevo.
- **Zona horaria**: las métricas "del mes" y las fechas se calculan en `America/Argentina/Buenos_Aires`.

## Datos públicos

- La regla de premios activa es legible sin login (rol `anon`), para mostrarla en la landing. Es información de marketing. Los descuentos asociados solo los ven clientes logueados.

## QR

- El QR del carnet contiene la URL `{SITE_URL}/panel/clientes/{id}`. El escáner del panel extrae el ID de esa URL (o de un UUID suelto). Ventaja: si el barbero escanea con la cámara común del celular, también abre directo la ficha del cliente. Si otra persona lo escanea, termina en el login: no se filtra nada.

## Carnet en vivo

- El carnet se suscribe por **Supabase Realtime** a los cambios de `cortes` y `canjes` del cliente (respetando RLS) y se refresca solo: el cliente ve el sello estamparse mientras está en la barbería. Como respaldo, también se refresca al volver a la pestaña.
- El último progreso visto se recuerda en el navegador, así el sello nuevo se "estampa" también cuando el cliente abre el carnet más tarde.

## Decisiones tomadas durante la construcción

- **`cacheComponents` desactivado.** El scaffold de Next 16.4 lo activa por defecto. Toda la app (salvo la landing) muestra datos por usuario, así que no gana nada con "static shells" y agrega complejidad (cada lectura de sesión tendría que ir detrás de un `<Suspense>`). La landing se cachea con `revalidate` (ISR) y se invalida al guardar una regla.
- **Doble chequeo de acceso.** `proxy.ts` redirige de forma optimista (rol y cambio de contraseña pendiente) y cada layout/acción vuelve a verificar en el servidor (`requireBarbero` / `requireCliente`). La protección final es el RLS de la base.
- **El teléfono se normaliza "a la argentina".** Además de dejar solo dígitos, se quitan `+54`, `+54 9` y el `0` inicial cuando el resultado queda en 10 dígitos. Así `02346 40-1122`, `+54 9 2346 401122` y `2346401122` son el mismo usuario (si no, un cliente no podría entrar por tipear distinto que el barbero). El `15` no se puede quitar de forma segura sin conocer el código de área, por eso la ayuda del alta pide cargarlo sin 0 ni 15.
- **Búsqueda sin tildes.** `perfiles.busqueda` es una columna generada (nombre sin tildes en minúscula + teléfono) con índice trigram: buscar "perez" encuentra "Pérez" y "4011" encuentra el teléfono.
- **El escáner sirve su WebAssembly desde la app** (`public/vendor/zxing_reader.wasm`, copiado en `postinstall`) en lugar de bajarlo de jsDelivr. Y se le quitan a la librería los mínimos de resolución (≥ 640 px de alto) que hacían fallar cámaras de 480p.
- **Página fuera de rango** en la lista de clientes (`?pagina=999`): vuelve a la página 1 en lugar de mostrar un error.
- **Permisos explícitos para `service_role`** en la migración, por si el proyecto de Supabase tiene desactivados los permisos automáticos del schema `public`.
- **"Supabase local" para desarrollo** (`npm run supabase:local`): un emulador mínimo de Auth y de la API REST sobre PGlite, con las migraciones, el seed y el RLS reales. Sirve para probar la app completa sin Docker ni cuenta de Supabase. No tiene Realtime (el carnet se refresca igual al volver a la pestaña).

## Dueño y empleado, precios y montos (migración `20261022000100`)

- **Dueño = barbero con `es_dueno = true`** (columna nueva en `perfiles`), en lugar de un rol nuevo. Así todo lo que ya chequea `rol = 'barbero'` (proxy, guards, `es_barbero()`, constraints) sigue igual para los dos, y lo exclusivo del dueño se agrega con `es_dueno()` / `_exigir_dueno()` / `requireDueno()`. Un check impide que un cliente sea dueño. Al aplicar la migración, **todo barbero existente queda como dueño** (en producción hay uno).
- **Permisos en las tres capas.** Base: RLS de `cortes` (el empleado lee solo los que cargó él), funciones SQL que exigen dueño (`facturacion`, `guardar_precio_cliente`, `guardar_regla`), `deshacer_corte` que rechaza cortes ajenos al empleado (`corte_ajeno`) y policies de escritura de descuentos solo para el dueño. Servidor: `requireDueno()` en páginas y Server Actions del dueño. `proxy.ts`: redirige al empleado de `/panel/caja`, `/panel/reglas` y `/panel/descuentos` al inicio.
- **La tarjeta de sellos del empleado cuenta todos los cortes.** Si la vista `resumen_clientes` (que es `security_invoker`) contara con el RLS del empleado, vería menos sellos de los reales. Los conteos pasan a `_totales_cliente()` (`security definer`), que devuelve solo cantidades y fecha del último corte —nunca montos ni quién lo hizo— y solo a barberos, al propio cliente o al servidor. La vista mantiene sus columnas y su orden (más `precio_habitual` al final), así la versión anterior de la app sigue funcionando.
- **Qué ve el empleado** (criterio pedido, con estos ajustes):
  - En la ficha: la tarjeta de sellos completa, "12 cortes, 2 premios" (cantidades totales) y la fecha del último corte, porque los necesita para atender. En el historial, solo sus cortes (con monto, sin numerar porque la numeración sería engañosa) y todos los canjes (no tienen montos y sirven para saber qué premios usó el cliente).
  - En Inicio: "Tus cortes en octubre" cuenta solo los suyos (`metricas_panel` distingue por rol); cantidad de clientes y canjes, igual que el dueño. La actividad reciente muestra sus cortes y todos los canjes.
  - **Sí puede editar nombre/teléfono y resetear la contraseña** de un cliente: son tareas de atención (el cliente se olvidó la clave estando en el local) y no tocan plata. No puede borrar clientes.
  - **No ve ni gestiona descuentos** (no estaban en la lista de lo que puede hacer). Los sigue viendo el cliente en su carnet.
  - **No carga precio en el alta**: el campo "Precio habitual" del alta aparece solo para el dueño (si el empleado lo manda igual, se ignora). El empleado escribe el monto al sumar el corte.
- **El dueño puede deshacer cualquier corte** dentro de los 10 minutos (incluidos los del empleado).
- **Monto del corte**: `numeric(12,2)`, de 0 a 9.999.999, opcional. Vacío = "Sin monto" (no se bloquea el registro si el cliente no tiene precio: atender rápido es prioridad). Se guarda exactamente lo que se confirma; no se toma el precio habitual por detrás. En la caja, los cortes sin monto se cuentan aparte por barbero ("3 sin monto") para que no pasen desapercibidos.
- **Cortes viejos**: quedan con `monto = null` y se muestran "Sin monto". Ya tenían `registrado_por` (la función siempre lo guardó y había un solo barbero), así que figuran como del dueño, que es correcto. Si un corte no tiene barbero (por ejemplo, porque se borró el usuario de un barbero), se muestra "Sin barbero" y en la caja aparece en una fila aparte.
- **Para dar de baja a un empleado no se borra el usuario** (sus cortes quedarían "Sin barbero"): se lo bloquea con `banned_until` (`supabase/quitar-empleado.sql`). Los barberos se gestionan por SQL, igual que el alta del primer barbero; no hay pantalla para eso.
- **`registrar_corte` suma `p_monto` opcional.** Se reemplaza la versión de 2 parámetros (si convivieran, PostgREST no sabría cuál llamar); como el parámetro nuevo tiene valor por defecto, la app anterior sigue funcionando entre la migración y el deploy. Por eso **la migración se aplica antes de publicar el código**: la app nueva lee `es_dueno` en el proxy.
- **Precio al registrar un corte**: el campo "Cobrás" está siempre visible con el precio precargado (teclado numérico, `inputMode="decimal"`); confirmar sigue siendo un solo toque en "Sumar corte". Se acepta "8.000", "8000", "8.500,50", "$ 8.000" y "8500.5" (el punto separa miles solo si va seguido de grupos de 3 dígitos). Si el dueño cambia el precio, el campo se vuelve a precargar.
- **Editar el precio habitual** pasa por la función SQL `guardar_precio_cliente` con la sesión del dueño (y no por la clave de servicio), para que la base lo valide. El precio cargado en el alta sí va con la clave de servicio, como el resto del alta, después de verificar en el servidor que quien da de alta es el dueño.
- **Historial con "Ver más"**: la ficha muestra 20 movimientos y "Ver más" suma de a 20 con `?historial=40` (funciona sin JavaScript extra y conserva la posición). Se dejó de mostrar "Primer corte: …" porque con la paginación ya no se carga el historial completo.
- **Caja** (`/panel/caja`, solo el dueño): períodos Hoy, Esta semana (desde el lunes), Este mes, Mes anterior y Este año, en hora argentina; total, promedio por corte con monto, detalle por barbero y lista paginada de cortes. En Inicio el dueño ve la caja del mes.
- **Navegación**: el dueño tiene "Caja" en el menú lateral y en la barra inferior del celular, donde reemplaza a "Descuentos" (la barra tiene 5 lugares); en el celular, Descuentos y Premios quedan como accesos en Inicio ("Configuración"). El empleado ve Inicio, Escanear y Clientes.
- **Formato de pesos**: "$ 8.000" / "$ 8.500,50" (con espacio que no corta línea), sin decimales cuando el monto es redondo.

## Limitaciones conocidas

- **Resetear la contraseña no cierra las sesiones abiertas** del cliente en otros dispositivos: Supabase no permite cerrar sesiones de otro usuario por id desde la API de admin. Si esa sesión sigue activa, al próximo uso se le pide elegir una contraseña nueva (porque `debe_cambiar_password` vuelve a `true`).
- **Límite de intentos de login.** El login corre en el servidor (Vercel), así que el límite por IP de Supabase Auth (30 intentos cada 5 minutos por defecto) se aplica a la IP del servidor, compartida por todos. Para una barbería alcanza de sobra; si hiciera falta más, se ajusta en Supabase → Authentication → Rate Limits.
- **Montos con el emulador local**: PGlite devuelve `numeric` como texto; el emulador lo convierte a número (como PostgREST) y además la app normaliza con `aNumero()`.
- **Concurrencia real** del canje (dos requests en paralelo) se garantiza con el bloqueo de fila en Postgres; los tests la cubren de forma secuencial porque PGlite tiene una sola conexión.
