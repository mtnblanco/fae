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

### Identidad visual "Noche con un neón"

Una barbería de noche con **un solo cartel encendido**. El neón (#FFE14D) es una lámpara, no un color de interfaz; el oro apagado (#C9A227) hace el trabajo de todos los días. Todo está en `src/app/globals.css` (tokens, brillos y utilidades); ningún componente define colores propios salvo los íconos de `next/og`, que no leen CSS (`COLORES_MARCA` en `src/lib/marca-svg.ts`).

- **Logo en pantalla: solo "FaeBarberShop"** en Tilt Neon, marfil y **sin brillo** (header, footer, panel, login y carnet). Pedido del cliente: nada de emblemas, poste, aro ni navaja (el poste se eliminó de toda la app), y la "F" de neón **solo** para favicon, ícono de la app e imagen OG.
- **Íconos, favicon y OG**: la "F" se dibuja como SVG con la **línea central de la F de Tilt Neon** (dos tubos con terminales redondas), así no depende de la fuente. Se pinta como un cartel: halo difuso, tubo amarillo y núcleo claro (`svgF()` en `marca-svg.ts`; resvg de `next/og` sí aplica `feGaussianBlur`). El favicon es de 32 px (16 pt × 2) con tubo más grueso, F más grande y halo corto; se verificó legible a 16 y 32 px sobre pestaña oscura y clara. Para la OG se agregó `src/assets/TiltNeon-Regular.ttf` (instancia estática, subset latin, 47 KB, OFL).
- **Una sola luz por pantalla (más el logo)**: landing → "suma." y "Ingresar a mi carnet"; login → "Ingresar"; carnet → sellos (y el carnet entero con halo suave cuando el premio está listo); ficha de cliente y escáner con cliente → "Sumar corte" (variante `neon`); escáner → el marco y la línea de lectura; inicio, caja, clientes y reglas → solo el logo (el panel es "la barbería con la luz apagada": oro y marfil).
- **Brillo según tamaño** (`.neon` ≥ 28 px, `.neon-suave` 16–27 px, nada debajo). Todos los brillos son estáticos; no se transiciona `box-shadow` ni `text-shadow` (el botón usa `transition-[color,background-color,border-color,opacity,translate]`).
- **Encendido**: los sellos nuevos se encienden a saltos con el mismo ritmo animando solo la `opacity` del `::after` que tiene la sombra. Con `prefers-reduced-motion` todo queda **encendido** y la línea del escáner, fija.
- **Sellos**: disco de neón con núcleo claro y la tijera en `--sobre-neon`. El siguiente a ganar va con borde oro y su número; los demás punteados con número ceniza; el último muestra el regalo. El sello sigue "cayendo" (transform) al sumarse.
- **Tipografías**: Gloock (títulos), Tilt Neon (solo la marca), Instrument Sans (UI, con eje `wdth` para las etiquetas condensadas `.etiqueta`). Los montos van en Instrument Sans semibold con cifras tabulares (el campo "Cobrás" y el total de caja, este en oro claro). Se quitó `cv11`, que Instrument Sans no tiene.
- **Tokens**: vocabulario nuevo (`noche`, `ebano`, `hierro`, `borde-campo`, `marfil`, `arena`, `ceniza`, `oro`, `neon`, `exito`, `error`…). Se renombraron todos los usos, así que **no quedaron alias** de los nombres viejos (`bronce`, `nogal`, `cuero`, `espresso`, `tinta`, `salvia`). Los inputs usan `--borde-campo` (3.8:1 contra el fondo, WCAG 1.4.11); los bordes de tarjetas, `--hierro` (decorativo).
- **Desvíos del manual**:
  - Además de `neon` y `default` (oro), el botón tiene una variante **`oro`** (contorno oro, para secundarias con nombre propio: "Canjear premio", "Ingresar" del encabezado). `outline` queda **neutro** (borde hierro claro, texto marfil; el oro aparece al pasar el dedo): el manual pedía `outline` y `ghost` en oro, pero se usan en paginación, cancelar de diálogos, "Ver ficha", etc., y con todo en oro el oro deja de señalar algo.
  - El botón de "Ingresar" del login también va en neón (es la acción principal de esa pantalla).
  - Los sellos usan un brillo propio más corto (`--brillo-sello`, máx. 14 px) en lugar de `--brillo-caja` (40 px): son chicos, van de a 5–10 y el halo grande se pisaba entre sellos.
  - En la landing, el carnet de muestra (con sus sellos) queda debajo del botón: en el primer pantallazo del celular se ven logo, "suma." y el botón, como pide el manual; los sellos aparecen al bajar.
  - Se sacó el `backdrop-blur` de la barra superior y la inferior del panel y de los diálogos (fondo sólido al 95–97 % y velo negro al 65 %): es caro en celulares de gama baja y el manual pide no combinarlo con brillos.
- **Pendiente con el cliente**: fotos reales del local o del cartel para el hero y la imagen OG.

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

- **Sellos y premios** (desde la migración `20261023000100`, premios por etapas; ver la sección propia más abajo): la tarjeta mide L cortes (el de la última etapa), `sellos = cortes % L` y cada etapa se gana una vez por vuelta. Con una sola etapa es exactamente la fórmula original: `sellos = cortes % N` y `premios disponibles = floor(cortes / N) - canjes` (nunca menor a 0). Si la regla cambia, se recalcula sobre todo el historial.
- **Visualmente**, cuando el cliente completó la tarjeta y todavía no canjeó el premio de la última etapa, la tarjeta se muestra llena (L/L) en lugar de 0/L; al canjear ese premio, vuelve a 0/L.
- **La regla tiene historial**: guardar una regla nueva desactiva la anterior en la misma transacción (`guardar_regla_etapas`). Cada canje guarda la etapa y la descripción del premio vigente en ese momento.
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

## Premios por etapas (migración `20261023000100`)

Pedido: premios configurables en varias etapas ("al 4.º corte 20% off, al 7.º 50% off, al 10.º corte gratis").

- **Modelo**: la regla tiene 1 a 6 etapas (`reglas.etapas`, jsonb `[{corte, descripcion}]`) con cortes distintos y crecientes, del 1 al 30. La última etapa define el largo de la tarjeta (L); al llegar, la tarjeta se completa y vuelve a empezar. Se eligió jsonb en la misma fila (y no una tabla aparte) porque la regla se lee y se reemplaza siempre entera, ya tiene historial por fila, y así la landing (rol `anon`) la sigue leyendo con la policy que ya existía. La base valida todo (`_etapas_validas()` en un `check`), no solo la app.
- **Compatibilidad**: `reglas.cortes_necesarios` y `descripcion_premio` se mantienen sincronizadas con la última etapa (trigger), y `resumen_clientes` conserva todas sus columnas (suma `etapas` y `premios` al final). `canjear_premio` agrega `p_etapa` opcional (sin etapa canjea el primer premio disponible) y `guardar_regla(n, texto)` crea una regla de una etapa. Así **la versión publicada de la app sigue funcionando contra la base migrada**, y como la regla migrada es de una etapa, ve exactamente lo mismo que antes.
- **Premio ganado**: cada vez que el cliente alcanza una etapa en una vuelta: `ganados(s) = floor(T / L) + (T % L >= s ? 1 : 0)`. **No vencen** al reiniciar la tarjeta: quedan disponibles hasta canjearse, y un cliente puede tener varios premios distintos (y repetidos) a la vez.
- **Canje**: el barbero elige cuál (si hay de más de una etapa, el diálogo muestra la lista y **ninguno viene marcado**, para no canjear el equivocado por apuro). El canje guarda `etapa` y `premio_descripcion`, con el mismo bloqueo de fila e idempotencia de siempre; no se puede canjear una etapa sin disponibles (`sin_premios`) ni una que la regla no tiene (`etapa_inexistente`).
- **Disponibles por etapa** (`_repartir_premios`, función pura que usan la vista, el canje y deshacer): `ganados(s) − canjes de esa etapa`. Los canjes que no coinciden con ninguna etapa actual (de una etapa que ya no existe) y los que exceden lo ganado en su etapa se descuentan de las otras, **empezando por la de menor número de corte** (el cliente conserva primero los premios más grandes). Resultado: nunca hay disponibles negativos y el total siempre es `max(0, ganados − canjes)`, la misma invariante de antes.
- **Cambio de regla**: se mantiene "se recalcula sobre todo el historial". Los canjes **nunca se borran ni se modifican** (conservan etapa y descripción), los disponibles se recalculan con las etapas nuevas, y si alguien ya usó más premios de los que le da la regla nueva queda en 0 (no en negativo). Algunos clientes pueden ganar un premio en el momento o tener que esperar más; el formulario lo avisa antes de guardar. Si el dueño vuelve a una etapa con el mismo número de corte, sus canjes vuelven a contar en esa etapa. Se descartó "congelar" los premios ganados al cambiar la regla: obligaba a escribir una fila por cliente en cada cambio, a llevar un corrimiento de cortes por cliente y rompía la compatibilidad con la app publicada, para un caso (cambiar la regla con clientes a mitad de tarjeta) que el aviso ya explica.
- **Canjes anteriores a la migración**: se completan con la etapa N de la regla vigente en su fecha. Con la regla de una etapa da lo mismo que dejarlos sin etapa (se probó que ningún cliente cambia de sellos ni disponibles).
- **Deshacer corte**: se rechaza si, sin ese corte, quedarían más canjes que premios ganados en total (como antes) **o** más canjes de la etapa que ganó ese corte que premios de esa etapa (por ejemplo: con el 7.º corte ganó el 50% off y ya se lo canjeó, aunque le quede el 20% off). Si ese premio sigue sin canjear, se puede deshacer.
- **Sumar corte sigue siendo un toque**. Si el corte alcanza una etapa, el aviso dice "¡Juan ganó 20% off!" y sale la celebración de siempre.
- **Sellos**: las posiciones con premio muestran el regalo (vacías: punteado oro; ganadas: el disco de neón con el regalo en lugar de la tijera). Una sola luz: no se agregó ningún brillo nuevo. Con tarjetas de más de 12 cortes la grilla usa 5 o 6 columnas (la que deje la última fila más completa), así 30 sellos entran en 5 filas a 360 px.
- **Editor de etapas**: filas "Corte n.º" (teclado numérico) + premio, agregar/quitar (mínimo 1, máximo 6), vista previa en vivo con la grilla y la lista de etapas. Las filas **se ordenan solas al salir de la lista** (no en cada campo: mover la fila mientras se pasa del número al premio le sacaba el foco al teclado del celular). Los errores aparecen en la fila y el campo exactos ("Ya hay otra etapa en el corte 3.") con las mismas reglas que valida la base.
- **Textos**: "Te faltan 2 cortes para 20% off" apunta a la **próxima etapa** de la tarjeta. Las descripciones se pasan a minúscula solo en la inicial y solo si es una palabra común ("Corte gratis" → "corte gratis", "50% OFF" queda igual).
- **Landing**: con varias etapas muestra "Premios en el camino" (una tarjeta por etapa con el número de corte grande en oro, sin brillo) y el carnet de muestra con los regalos en sus posiciones. Con una sola etapa queda como antes.
- **Seed**: la regla "cada 5 cortes" queda como historial y la activa es "4: 20% off · 7: 50% off · 10: Corte gratis" (los canjes del seed son de la etapa 5 de la regla vieja, así también se ve el caso de canjes de una etapa que ya no existe).

## Limitaciones conocidas

- **Resetear la contraseña no cierra las sesiones abiertas** del cliente en otros dispositivos: Supabase no permite cerrar sesiones de otro usuario por id desde la API de admin. Si esa sesión sigue activa, al próximo uso se le pide elegir una contraseña nueva (porque `debe_cambiar_password` vuelve a `true`).
- **Límite de intentos de login.** El login corre en el servidor (Vercel), así que el límite por IP de Supabase Auth (30 intentos cada 5 minutos por defecto) se aplica a la IP del servidor, compartida por todos. Para una barbería alcanza de sobra; si hiciera falta más, se ajusta en Supabase → Authentication → Rate Limits.
- **Montos con el emulador local**: PGlite devuelve `numeric` como texto; el emulador lo convierte a número (como PostgREST) y además la app normaliza con `aNumero()`.
- **Concurrencia real** del canje (dos requests en paralelo) se garantiza con el bloqueo de fila en Postgres; los tests la cubren de forma secuencial porque PGlite tiene una sola conexión.
