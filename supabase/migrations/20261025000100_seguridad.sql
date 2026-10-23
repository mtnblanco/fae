-- ════════════════════════════════════════════════════════════════════════════
-- Seguridad (auditoría del 23/10/2026).
--
--   1. Barbero ACTIVO: es_barbero() y es_dueno() exigen que la cuenta no esté
--      bloqueada (auth.users.banned_until) ni tenga un cambio de contraseña
--      pendiente. Un empleado dado de baja pierde los permisos en el acto,
--      aunque todavía tenga un token válido.
--   2. Sesiones: revocar_sesiones(usuario) borra todas las sesiones de Auth de
--      un usuario (solo service_role). La app la usa al resetear una contraseña.
--   3. Cambio de contraseña pendiente: mientras debe_cambiar_password = true,
--      el cliente no puede reservar, cancelar ni ver su turno (además del
--      redirect de la app).
--   4. Límite de intentos (login y cambio de contraseña): tabla `intentos` y
--      consumir_intento() / limpiar_intentos() (solo service_role).
--   5. Notificaciones push: solo endpoints de servicios push reales (FCM,
--      Mozilla, Apple, Windows), hasta 10 dispositivos por barbero y sin pisar
--      la suscripción de otro barbero.
--   6. Spam de turnos: hasta 5 reservas y 3 cancelaciones del cliente cada 24 h.
--   7. reservar_para_cliente: la clave de idempotencia también compara el barbero.
--   8. Registro de reseteos de contraseña (quién y cuándo).
--
-- Pensada para aplicarse sobre una base EN USO:
--   · No cambia firmas de funciones existentes: la versión publicada de la app
--     sigue funcionando igual. Lo único que puede notar es que ahora la base
--     rechaza suscripciones push de hosts que no son servicios push, y que
--     corta el spam de reservas (en esos casos la app vieja muestra el mensaje
--     genérico "Algo salió mal").
--   · Borra las suscripciones push que no apuntan a un servicio push real
--     (no sirven para notificar a nadie) y deja como máximo 10 por barbero.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Barbero activo ──────────────────────────────────────────────────────
-- Se llaman en cada policy (una vez por consulta, con `(select …)`) y en cada
-- función del panel: son dos búsquedas por clave primaria.
create or replace function public.es_barbero()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    join auth.users u on u.id = p.id
    where p.id = (select auth.uid())
      and p.rol = 'barbero'
      and not p.debe_cambiar_password
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

comment on function public.es_barbero() is
  'true si el usuario autenticado es un barbero activo (no bloqueado y sin cambio de contraseña pendiente).';

create or replace function public.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles p
    join auth.users u on u.id = p.id
    where p.id = (select auth.uid())
      and p.rol = 'barbero'
      and p.es_dueno
      and not p.debe_cambiar_password
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

comment on function public.es_dueno() is
  'true si el usuario autenticado es el barbero dueño (o admin) y está activo.';

-- ─── 2. Revocar sesiones (solo el servidor) ─────────────────────────────────
-- Borra las sesiones de Auth del usuario: los refresh tokens se borran en
-- cascada, así que ninguna sesión abierta (cookie de 400 días) puede renovarse.
-- El access token ya emitido vale hasta que vence (jwt_expiry, 1 h): por eso
-- el cambio obligatorio pide también la contraseña temporal.
create or replace function public.revocar_sesiones(p_usuario uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sesiones integer;
begin
  if p_usuario is null then
    return 0;
  end if;
  delete from auth.sessions where user_id = p_usuario;
  get diagnostics v_sesiones = row_count;
  -- Refresh tokens viejos sin sesión asociada (por las dudas).
  delete from auth.refresh_tokens where user_id = p_usuario::text;
  return v_sesiones;
end;
$$;

comment on function public.revocar_sesiones(uuid) is
  'Cierra todas las sesiones de Auth de un usuario (borra sesiones y refresh tokens). Solo service_role.';

-- ─── 3. Registro de reseteos de contraseña ──────────────────────────────────
create table if not exists public.reseteos_password (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfiles (id) on delete cascade,
  barbero_id uuid references public.perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

comment on table public.reseteos_password is
  'Quién reseteó la contraseña de cada cliente y cuándo. Lo escribe el servidor; lo lee el dueño.';

create index if not exists reseteos_password_cliente_idx
  on public.reseteos_password (cliente_id, creado_en desc);

-- ─── 4. Límite de intentos ──────────────────────────────────────────────────
-- Una fila por intento. Solo la usa el servidor (service_role): login y
-- verificación de contraseña. Las filas de más de un día se borran solas.
create table if not exists public.intentos (
  id bigint generated always as identity primary key,
  clave text not null,
  en timestamptz not null default now(),
  constraint intentos_clave_valida check (char_length(clave) between 1 and 200)
);

comment on table public.intentos is
  'Intentos de login / verificación de contraseña por clave (IP, cuenta). Para el límite de intentos.';

create index if not exists intentos_clave_en_idx on public.intentos (clave, en desc);
create index if not exists intentos_en_idx on public.intentos (en);

-- Registra un intento si la clave no superó el máximo en la ventana.
-- Devuelve 0 si se permitió, o cuántos segundos faltan para poder reintentar.
-- Los intentos rechazados no se registran (no alargan el bloqueo).
create or replace function public.consumir_intento(
  p_clave text,
  p_max integer,
  p_ventana_seg integer
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz;
  v_cantidad integer;
  v_primero timestamptz;
begin
  if p_clave is null or char_length(p_clave) not between 1 and 200
     or p_max is null or p_max < 1
     or p_ventana_seg is null or p_ventana_seg not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'datos_invalidos',
      hint = 'Clave, máximo o ventana inválidos.';
  end if;

  -- Serializa los intentos de una misma clave (dos requests a la vez no pasan los dos).
  perform pg_advisory_xact_lock(hashtextextended('intentos:' || p_clave, 0));

  -- Limpieza oportunista (por índice): nadie usa ventanas de más de un día.
  delete from public.intentos where en < now() - interval '1 day';

  v_desde := now() - make_interval(secs => p_ventana_seg);
  select count(*)::integer, min(x.en) into v_cantidad, v_primero
  from (
    select i.en
    from public.intentos i
    where i.clave = p_clave and i.en > v_desde
    order by i.en desc
    limit p_max
  ) x;

  if v_cantidad >= p_max then
    -- Se libera un lugar cuando el más viejo de los últimos p_max sale de la ventana.
    return greatest(1, ceil(extract(epoch from (v_primero - v_desde)))::integer);
  end if;

  insert into public.intentos (clave) values (p_clave);
  return 0;
end;
$$;

comment on function public.consumir_intento(text, integer, integer) is
  'Límite de intentos: registra uno y devuelve 0, o devuelve los segundos de espera si la clave llegó al máximo en la ventana. Solo service_role.';

-- Después de un login correcto: borra los intentos de la cuenta (o solo el
-- último, para la IP: así un login correcto no cuenta como intento).
create or replace function public.limpiar_intentos(p_clave text, p_solo_ultimo boolean default false)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_solo_ultimo then
    delete from public.intentos
    where id = (
      select i.id from public.intentos i where i.clave = p_clave order by i.en desc, i.id desc limit 1
    );
  else
    delete from public.intentos where clave = p_clave;
  end if;
end;
$$;

comment on function public.limpiar_intentos(text, boolean) is
  'Borra los intentos de una clave (o solo el último). Solo service_role.';

-- ─── 5. Notificaciones push ─────────────────────────────────────────────────
-- Solo servicios push de los navegadores (mismo criterio en
-- src/lib/push/endpoints.ts): Chrome/Edge/Android/Samsung/Opera (FCM),
-- Firefox (Mozilla autopush), Safari/iPhone (Apple) y Windows (WNS).
-- Puerto 443 implícito: después del host tiene que venir "/".

-- Las suscripciones que no apuntan a un servicio push no le sirven a nadie.
delete from public.suscripciones_push
where endpoint !~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/';

-- Como máximo 10 por barbero (quedan las más recientes).
delete from public.suscripciones_push s
where s.id in (
  select x.id
  from (
    select id, row_number() over (
      partition by barbero_id order by actualizada_en desc, created_at desc, id
    ) as n
    from public.suscripciones_push
  ) x
  where x.n > 10
);

alter table public.suscripciones_push drop constraint if exists suscripciones_endpoint_valido;
alter table public.suscripciones_push
  add constraint suscripciones_endpoint_valido check (
    char_length(endpoint) <= 1000
    and endpoint ~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
  );

create or replace function public.guardar_suscripcion_push(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  perform public._exigir_barbero();

  if not public._es_barbero_id(v_uid) then
    raise exception using errcode = '42501', message = 'no_autorizado',
      hint = 'El admin no tiene turnos: no recibe notificaciones.';
  end if;

  if p_endpoint is null
     or char_length(p_endpoint) > 1000
     or p_endpoint !~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/' then
    raise exception using errcode = '22023', message = 'suscripcion_invalida',
      hint = 'El endpoint no es de un servicio push conocido.';
  end if;

  begin
    -- Si el endpoint ya es de OTRO barbero, solo pasa a quien lo activa si
    -- trae las mismas claves (es el mismo navegador). Así nadie se apropia de
    -- la suscripción de otro conociendo solo el endpoint.
    insert into public.suscripciones_push (barbero_id, endpoint, p256dh, auth)
    values (v_uid, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update
      set barbero_id = excluded.barbero_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          actualizada_en = now()
      where public.suscripciones_push.barbero_id = excluded.barbero_id
         or (public.suscripciones_push.p256dh = excluded.p256dh
             and public.suscripciones_push.auth = excluded.auth);
    if not found then
      raise exception using errcode = '22023', message = 'suscripcion_invalida',
        hint = 'Ese dispositivo ya está suscripto por otro barbero.';
    end if;
  exception when check_violation or not_null_violation then
    raise exception using errcode = '22023', message = 'suscripcion_invalida',
      hint = 'La suscripción del navegador no es válida.';
  end;

  -- Hasta 10 dispositivos por barbero: se va el más viejo.
  delete from public.suscripciones_push s
  where s.barbero_id = v_uid
    and s.id not in (
      select x.id from public.suscripciones_push x
      where x.barbero_id = v_uid
      order by x.actualizada_en desc, x.created_at desc, x.id
      limit 10
    );
end;
$$;

comment on function public.guardar_suscripcion_push(text, text, text) is
  'Guarda la suscripción push del dispositivo del barbero (solo servicios push reales, hasta 10 por barbero).';

-- ─── 6. Turnos: cliente activo y límites anti-spam ──────────────────────────
-- Reservar: 1 turno activo, hasta 5 reservas propias cada 24 h, y no con un
-- cambio de contraseña pendiente. El resto, igual que antes.
create or replace function public.reservar_turno(
  p_barbero uuid,
  p_inicio timestamptz,
  p_solicitud_id uuid default null
)
returns public.turnos
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ahora timestamptz := public._ahora();
  v_fecha date := (p_inicio at time zone 'America/Argentina/Buenos_Aires')::date;
  v_fin timestamptz;
  v_turno public.turnos;
  v_pendiente boolean;
begin
  select p.debe_cambiar_password into v_pendiente
  from public.perfiles p
  where p.id = v_uid and p.rol = 'cliente';
  if v_uid is null or not found then
    raise exception using errcode = '42501', message = 'no_autorizado',
      hint = 'Solo un cliente puede reservar su turno.';
  end if;
  if v_pendiente then
    raise exception using errcode = '42501', message = 'cambio_password_pendiente',
      hint = 'Primero tiene que elegir su contraseña nueva.';
  end if;

  -- Serializa las reservas de un mismo cliente (límite de 1 turno activo).
  perform public._bloquear_cliente(v_uid);

  if p_solicitud_id is not null then
    select * into v_turno from public.turnos where solicitud_id = p_solicitud_id;
    if found then
      if v_turno.cliente_id is distinct from v_uid then
        raise exception using errcode = 'P0001', message = 'solicitud_invalida',
          hint = 'La clave de solicitud ya se usó.';
      end if;
      return v_turno;
    end if;
  end if;

  if exists (
    select 1 from public.turnos
    where cliente_id = v_uid and tipo = 'reserva' and estado = 'reservado' and fin > v_ahora
  ) then
    raise exception using errcode = 'P0001', message = 'turno_activo',
      hint = 'El cliente ya tiene un turno reservado.';
  end if;

  -- Anti-spam: cada reserva le manda una notificación al barbero.
  if (
    select count(*) from public.turnos
    where cliente_id = v_uid and creado_por = v_uid and created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception using errcode = 'P0001', message = 'demasiadas_reservas',
      hint = 'El cliente ya reservó 5 veces en las últimas 24 horas.';
  end if;

  if not public._es_barbero_id(p_barbero) then
    raise exception using errcode = 'P0002', message = 'barbero_inexistente',
      hint = 'Ese barbero no existe.';
  end if;

  if p_inicio is null or p_inicio < v_ahora + interval '1 hour' then
    raise exception using errcode = 'P0001', message = 'turno_muy_pronto',
      hint = 'Los turnos se reservan con al menos 1 hora de anticipación.';
  end if;

  if v_fecha > public._hoy_turnos() + 13 then
    raise exception using errcode = 'P0001', message = 'turno_fuera_de_ventana',
      hint = 'Los turnos se reservan hasta 14 días adelante.';
  end if;

  select s.fin into v_fin
  from public._slots(p_barbero, v_fecha, v_fecha) s
  where s.inicio = p_inicio;
  if not found then
    raise exception using errcode = 'P0001', message = 'horario_invalido',
      hint = 'Ese horario no está en la agenda del barbero.';
  end if;

  begin
    insert into public.turnos (barbero_id, cliente_id, tipo, inicio, fin, creado_por, solicitud_id)
    values (p_barbero, v_uid, 'reserva', p_inicio, v_fin, v_uid, p_solicitud_id)
    returning * into v_turno;
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'horario_ocupado',
      hint = 'Ese horario se acaba de ocupar.';
  end;

  return v_turno;
end;
$$;

comment on function public.reservar_turno(uuid, timestamptz, uuid) is
  'El cliente reserva un horario libre. 1 h de anticipación, 14 días, 1 turno activo, hasta 5 reservas cada 24 h. Idempotente por solicitud.';

-- Cancelar: el cliente, hasta 3 cancelaciones cada 24 h (después, por WhatsApp).
create or replace function public.cancelar_turno(p_turno_id uuid)
returns public.turnos
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_turno public.turnos;
  v_es_cliente boolean := false;
begin
  select * into v_turno from public.turnos where id = p_turno_id for update;

  if not found or v_uid is null then
    raise exception using errcode = 'P0002', message = 'turno_inexistente',
      hint = 'El turno no existe.';
  end if;

  if public.es_barbero() then
    if v_turno.barbero_id <> v_uid and not public.es_dueno() then
      raise exception using errcode = '42501', message = 'no_autorizado',
        hint = 'El empleado solo cancela turnos de su agenda.';
    end if;
  elsif v_turno.cliente_id = v_uid then
    v_es_cliente := true;
    if exists (select 1 from public.perfiles where id = v_uid and debe_cambiar_password) then
      raise exception using errcode = '42501', message = 'cambio_password_pendiente',
        hint = 'Primero tiene que elegir su contraseña nueva.';
    end if;
    if v_turno.estado = 'reservado' and v_turno.inicio - public._ahora() < interval '3 hours' then
      raise exception using errcode = 'P0001', message = 'cancelacion_tardia',
        hint = 'Faltan menos de 3 horas: hay que avisar por WhatsApp.';
    end if;
  else
    -- Un cliente no se entera de que existe un turno ajeno.
    raise exception using errcode = 'P0002', message = 'turno_inexistente',
      hint = 'El turno no existe.';
  end if;

  if v_turno.estado = 'cancelado' then
    return v_turno;
  end if;

  if v_turno.estado = 'atendido' then
    raise exception using errcode = 'P0001', message = 'turno_atendido',
      hint = 'El turno ya fue atendido.';
  end if;

  -- Anti-spam: cada cancelación le manda una notificación al barbero.
  if v_es_cliente and (
    select count(*) from public.turnos
    where cliente_id = v_uid and cancelado_por = v_uid and cancelado_en > now() - interval '24 hours'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'demasiadas_cancelaciones',
      hint = 'El cliente ya canceló 3 turnos en las últimas 24 horas.';
  end if;

  update public.turnos
  set estado = 'cancelado', cancelado_por = v_uid, cancelado_en = now()
  where id = p_turno_id
  returning * into v_turno;

  return v_turno;
end;
$$;

comment on function public.cancelar_turno(uuid) is
  'Cancela un turno o quita un bloqueo. Cliente: los suyos, hasta 3 h antes y hasta 3 cada 24 h. Empleado: su agenda. Dueño: todos.';

-- Próximo turno del cliente: no con un cambio de contraseña pendiente.
create or replace function public.mi_proximo_turno()
returns table (
  id uuid,
  barbero_id uuid,
  barbero_nombre text,
  inicio timestamptz,
  fin timestamptz,
  puede_cancelar boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.barbero_id, b.nombre, t.inicio, t.fin,
         t.inicio - public._ahora() >= interval '3 hours'
  from public.turnos t
  join public.perfiles b on b.id = t.barbero_id
  where t.cliente_id = (select auth.uid())
    and t.tipo = 'reserva'
    and t.estado = 'reservado'
    and t.fin > public._ahora()
    and not exists (
      select 1 from public.perfiles c
      where c.id = (select auth.uid()) and c.debe_cambiar_password
    )
  order by t.inicio
  limit 1;
$$;

-- ─── 7. reservar_para_cliente: idempotencia por cliente Y barbero ───────────
create or replace function public.reservar_para_cliente(
  p_barbero uuid,
  p_cliente_id uuid,
  p_inicio timestamptz,
  p_solicitud_id uuid default null
)
returns public.turnos
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_fecha date := (p_inicio at time zone 'America/Argentina/Buenos_Aires')::date;
  v_fin timestamptz;
  v_turno public.turnos;
begin
  perform public._exigir_agenda(p_barbero);
  perform public._bloquear_cliente(p_cliente_id);

  if p_solicitud_id is not null then
    select * into v_turno from public.turnos where solicitud_id = p_solicitud_id;
    if found then
      -- La clave tiene que ser de este cliente Y de esta agenda: si no, no se
      -- devuelve nada (el turno puede ser de una agenda que no le corresponde).
      if v_turno.cliente_id is distinct from p_cliente_id
         or v_turno.barbero_id is distinct from p_barbero then
        raise exception using errcode = 'P0001', message = 'solicitud_invalida',
          hint = 'La clave de solicitud ya se usó.';
      end if;
      return v_turno;
    end if;
  end if;

  -- El barbero no tiene límite de anticipación, ventana ni cantidad (lo decide
  -- él), pero el horario tiene que estar en su agenda y no haber terminado.
  select s.fin into v_fin
  from public._slots(p_barbero, v_fecha, v_fecha) s
  where s.inicio = p_inicio;
  if not found then
    raise exception using errcode = 'P0001', message = 'horario_invalido',
      hint = 'Ese horario no está en la agenda del barbero.';
  end if;

  if v_fin <= public._ahora() then
    raise exception using errcode = 'P0001', message = 'horario_pasado',
      hint = 'Ese horario ya pasó.';
  end if;

  begin
    insert into public.turnos (barbero_id, cliente_id, tipo, inicio, fin, creado_por, solicitud_id)
    values (p_barbero, p_cliente_id, 'reserva', p_inicio, v_fin, v_uid, p_solicitud_id)
    returning * into v_turno;
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'horario_ocupado',
      hint = 'Ese horario se acaba de ocupar.';
  end;

  return v_turno;
end;
$$;

comment on function public.reservar_para_cliente(uuid, uuid, timestamptz, uuid) is
  'El barbero reserva un horario de su agenda para un cliente (pedido por teléfono o en persona).';

-- ─── RLS y permisos ─────────────────────────────────────────────────────────
alter table public.reseteos_password enable row level security;
alter table public.intentos enable row level security;

revoke all on table public.reseteos_password, public.intentos from anon, authenticated;
grant select on table public.reseteos_password to authenticated;
grant all on table public.reseteos_password, public.intentos to service_role;

-- `intentos` no tiene policies: nadie salvo service_role la lee ni la escribe.
create policy "reseteos: solo el dueño los ve"
  on public.reseteos_password
  for select
  to authenticated
  using ((select public.es_dueno()));

revoke execute on function
  public.revocar_sesiones(uuid),
  public.consumir_intento(text, integer, integer),
  public.limpiar_intentos(text, boolean)
from public, anon, authenticated;

grant execute on function
  public.revocar_sesiones(uuid),
  public.consumir_intento(text, integer, integer),
  public.limpiar_intentos(text, boolean)
to service_role;
