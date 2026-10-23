-- ════════════════════════════════════════════════════════════════════════════
-- Turnos online.
--
-- Cada barbero carga su horario semanal (franjas por día, con turnos de 30 o
-- 60 minutos), días especiales (cerrado u horario distinto) y bloqueos sueltos.
-- El cliente elige barbero, día y horario, y reserva. El barbero ve su agenda
-- del día (en vivo, por Realtime) y recibe notificaciones push.
--
-- Pensada para aplicarse sobre una base EN USO: solo agrega tablas, funciones
-- y un trigger en cortes. No cambia ni borra datos, y la versión anterior de la
-- app sigue funcionando igual (no usa nada de esto).
--
-- Reglas (fijas, también en src/lib/turnos/reglas.ts):
--   · Anticipación mínima: 1 hora.       · Ventana: hoy + 13 días (14 días).
--   · 1 turno futuro activo por cliente. · El cliente cancela hasta 3 h antes.
--   · Zona horaria: America/Argentina/Buenos_Aires.
--
-- Seguridad: como en el resto del proyecto, todo se escribe por funciones
-- security definer que validan el rol. El cliente nunca lee la tabla de turnos:
-- solo recibe horarios libres (sin datos de quién reservó) y su propio turno.
-- ════════════════════════════════════════════════════════════════════════════

-- Para el exclusion constraint (uuid/smallint con =, rangos con &&).
create extension if not exists btree_gist with schema extensions;

-- ─── Reloj ──────────────────────────────────────────────────────────────────
-- Todas las funciones de turnos leen la hora de acá (los tests la reemplazan
-- para probar anticipación, ventana y plazos de cancelación).
create or replace function public._ahora()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

create or replace function public._hoy_turnos()
returns date
language sql
stable
set search_path = ''
as $$
  select (public._ahora() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- ─── horarios_semanales ─────────────────────────────────────────────────────
-- Horario de todas las semanas: una o más franjas por día y barbero.
create table public.horarios_semanales (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.perfiles (id) on delete cascade,
  dia_semana smallint not null,
  desde time not null,
  hasta time not null,
  duracion_min smallint not null,
  created_at timestamptz not null default now(),

  constraint horarios_dia_valido check (dia_semana between 0 and 6),
  constraint horarios_duracion_valida check (duracion_min in (30, 60)),
  constraint horarios_media_hora check (
    extract(minute from desde) in (0, 30) and extract(second from desde) = 0
    and extract(minute from hasta) in (0, 30) and extract(second from hasta) = 0
  ),
  constraint horarios_entra_un_turno check (hasta - desde >= make_interval(mins => duracion_min)),
  constraint horarios_sin_superposicion exclude using gist (
    barbero_id with =,
    dia_semana with =,
    tsrange('2000-01-01'::date + desde, '2000-01-01'::date + hasta) with &&
  )
);

comment on table public.horarios_semanales is
  'Horario semanal de cada barbero. dia_semana: 0 = domingo … 6 = sábado. Los turnos arrancan en "desde" y avanzan de a duracion_min.';

-- ─── dias_especiales ────────────────────────────────────────────────────────
-- Si un barbero tiene filas para una fecha, REEMPLAZAN su horario semanal de ese
-- día: una fila "cerrado" (no atiende) o una o más franjas con horario distinto.
create table public.dias_especiales (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.perfiles (id) on delete cascade,
  fecha date not null,
  cerrado boolean not null default false,
  desde time,
  hasta time,
  duracion_min smallint,
  motivo text,
  created_at timestamptz not null default now(),

  constraint dias_especiales_motivo_largo check (motivo is null or char_length(motivo) <= 60),
  constraint dias_especiales_forma check (
    (cerrado and desde is null and hasta is null and duracion_min is null)
    or (
      not cerrado
      and desde is not null and hasta is not null
      and duracion_min in (30, 60)
      and extract(minute from desde) in (0, 30) and extract(second from desde) = 0
      and extract(minute from hasta) in (0, 30) and extract(second from hasta) = 0
      and hasta - desde >= make_interval(mins => duracion_min)
    )
  ),
  -- Franjas sin superponerse, y "cerrado" ocupa el día entero (no convive con franjas).
  constraint dias_especiales_sin_superposicion exclude using gist (
    barbero_id with =,
    tsrange(fecha + coalesce(desde, '00:00'::time), fecha + coalesce(hasta, '24:00'::time)) with &&
  )
);

comment on table public.dias_especiales is
  'Excepciones por fecha: cerrado u horario distinto. Reemplazan el horario semanal de ese día.';

create index dias_especiales_barbero_fecha_idx on public.dias_especiales (barbero_id, fecha);

-- ─── turnos ─────────────────────────────────────────────────────────────────
-- Reservas y bloqueos en la misma tabla: el mismo constraint impide reservar
-- encima de un bloqueo y bloquear encima de una reserva.
create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.perfiles (id) on delete cascade,
  cliente_id uuid references public.perfiles (id) on delete cascade,
  tipo text not null default 'reserva',
  estado text not null default 'reservado',
  inicio timestamptz not null,
  fin timestamptz not null,
  rango tstzrange generated always as (tstzrange(inicio, fin, '[)')) stored,
  nota text,
  corte_id uuid unique references public.cortes (id) on delete set null,
  creado_por uuid references public.perfiles (id) on delete set null,
  cancelado_por uuid references public.perfiles (id) on delete set null,
  cancelado_en timestamptz,
  -- Clave de idempotencia: un doble toque no reserva dos veces.
  solicitud_id uuid unique,
  created_at timestamptz not null default now(),

  constraint turnos_tipo_valido check (tipo in ('reserva', 'bloqueo')),
  constraint turnos_estado_valido check (estado in ('reservado', 'atendido', 'cancelado')),
  constraint turnos_reserva_con_cliente check ((tipo = 'reserva') = (cliente_id is not null)),
  constraint turnos_bloqueo_no_se_atiende check (tipo = 'reserva' or estado <> 'atendido'),
  constraint turnos_cancelacion check ((estado = 'cancelado') = (cancelado_en is not null)),
  constraint turnos_duracion_valida check (fin > inicio and fin - inicio <= interval '12 hours'),
  constraint turnos_nota_largo check (nota is null or char_length(nota) <= 120),
  -- Anti doble reserva, a prueba de concurrencia: dos turnos activos del mismo
  -- barbero no se pueden superponer. Los cancelados liberan el horario.
  constraint turnos_sin_superposicion exclude using gist (
    barbero_id with =,
    rango with &&
  ) where (estado <> 'cancelado')
);

comment on table public.turnos is
  'Turnos reservados (tipo reserva) y horarios bloqueados por el barbero (tipo bloqueo).';

create index turnos_barbero_inicio_idx on public.turnos (barbero_id, inicio);
create index turnos_cliente_inicio_idx on public.turnos (cliente_id, inicio desc)
  where cliente_id is not null;

-- ─── suscripciones_push ─────────────────────────────────────────────────────
-- Dispositivos de cada barbero que reciben avisos (Web Push).
create table public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.perfiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),

  constraint suscripciones_endpoint_valido check (
    endpoint ~ '^https://' and char_length(endpoint) <= 1000
  ),
  constraint suscripciones_claves_validas check (
    char_length(p256dh) between 10 and 200 and char_length(auth) between 4 and 100
  )
);

comment on table public.suscripciones_push is
  'Suscripciones Web Push de los barberos (una por dispositivo). Las vencidas se borran al enviar.';

create index suscripciones_push_barbero_idx on public.suscripciones_push (barbero_id);

-- ─── Helpers internos ───────────────────────────────────────────────────────
create or replace function public._es_barbero_id(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfiles where id = p_id and rol = 'barbero');
$$;

-- El dueño maneja la agenda de todos; el empleado, solo la suya.
create or replace function public._exigir_agenda(p_barbero uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._exigir_barbero();
  if not public._es_barbero_id(p_barbero) then
    raise exception using errcode = 'P0002', message = 'barbero_inexistente',
      hint = 'Ese barbero no existe.';
  end if;
  if p_barbero <> (select auth.uid()) and not public.es_dueno() then
    raise exception using errcode = '42501', message = 'no_autorizado',
      hint = 'El empleado solo maneja su propia agenda.';
  end if;
end;
$$;

-- Franjas efectivas de un barbero en una fecha: el día especial (si hay)
-- reemplaza al horario semanal.
create or replace function public._franjas_del_dia(p_barbero uuid, p_fecha date)
returns table (desde time, hasta time, duracion_min smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.desde, e.hasta, e.duracion_min
  from public.dias_especiales e
  where e.barbero_id = p_barbero and e.fecha = p_fecha and not e.cerrado
  union all
  select h.desde, h.hasta, h.duracion_min
  from public.horarios_semanales h
  where h.barbero_id = p_barbero
    and h.dia_semana = extract(dow from p_fecha)
    and not exists (
      select 1 from public.dias_especiales e where e.barbero_id = p_barbero and e.fecha = p_fecha
    );
$$;

-- Todos los turnos posibles (libres u ocupados) entre dos fechas, en hora argentina.
-- Arrancan en "desde" y avanzan de a duracion_min; solo los que entran enteros.
create or replace function public._slots(p_barbero uuid, p_desde date, p_hasta date)
returns table (fecha date, inicio timestamptz, fin timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.fecha,
    (d.fecha + f.desde + make_interval(mins => n.i * f.duracion_min))
      at time zone 'America/Argentina/Buenos_Aires',
    (d.fecha + f.desde + make_interval(mins => (n.i + 1) * f.duracion_min))
      at time zone 'America/Argentina/Buenos_Aires'
  from generate_series(0, greatest(p_hasta - p_desde, -1)) as g(k)
  cross join lateral (select p_desde + g.k as fecha) d
  cross join lateral public._franjas_del_dia(p_barbero, d.fecha) f
  cross join lateral generate_series(
    0,
    (extract(epoch from (f.hasta - f.desde))::integer / 60) / f.duracion_min - 1
  ) as n(i);
$$;

-- ─── Cliente: barberos y horarios libres ────────────────────────────────────
-- Horarios LIBRES de un barbero (sin datos de quién reservó los otros), desde
-- 1 hora en adelante y hasta hoy + 13 días.
create or replace function public.horarios_libres(p_barbero uuid)
returns table (inicio timestamptz, fin timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoy date := public._hoy_turnos();
  v_desde timestamptz := public._ahora() + interval '1 hour';
begin
  if (select auth.uid()) is null or not public._es_barbero_id(p_barbero) then
    return;
  end if;

  return query
  select s.inicio, s.fin
  from public._slots(p_barbero, v_hoy, v_hoy + 13) s
  where s.inicio >= v_desde
    and not exists (
      select 1 from public.turnos t
      where t.barbero_id = p_barbero
        and t.estado <> 'cancelado'
        and t.rango && tstzrange(s.inicio, s.fin, '[)')
    )
  order by s.inicio;
end;
$$;

comment on function public.horarios_libres(uuid) is
  'Horarios libres de un barbero (desde 1 h en adelante, 14 días). No devuelve quién reservó los ocupados.';

-- Barberos que dan turnos (tienen horario cargado), con su próximo horario libre.
create or replace function public.barberos_turnos()
returns table (id uuid, nombre text, es_dueno boolean, proximo_libre timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.nombre,
    p.es_dueno,
    (select min(l.inicio) from public.horarios_libres(p.id) l)
  from public.perfiles p
  where p.rol = 'barbero'
    and (select auth.uid()) is not null
    and (
      exists (select 1 from public.horarios_semanales h where h.barbero_id = p.id)
      or exists (
        select 1 from public.dias_especiales e
        where e.barbero_id = p.id and not e.cerrado and e.fecha >= public._hoy_turnos()
      )
    )
  order by p.es_dueno desc, p.nombre;
$$;

comment on function public.barberos_turnos() is
  'Barberos con horario cargado y su próximo horario libre. Solo nombre: nada de datos privados.';

-- ─── Cliente: reservar ──────────────────────────────────────────────────────
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
begin
  if v_uid is null or not exists (
    select 1 from public.perfiles where id = v_uid and rol = 'cliente'
  ) then
    raise exception using errcode = '42501', message = 'no_autorizado',
      hint = 'Solo un cliente puede reservar su turno.';
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
  'El cliente reserva un horario libre. 1 h de anticipación, 14 días, 1 turno activo. Idempotente por solicitud.';

-- ─── Cancelar (cliente o barbero) ───────────────────────────────────────────
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

  update public.turnos
  set estado = 'cancelado', cancelado_por = v_uid, cancelado_en = now()
  where id = p_turno_id
  returning * into v_turno;

  return v_turno;
end;
$$;

comment on function public.cancelar_turno(uuid) is
  'Cancela un turno o quita un bloqueo. Cliente: los suyos, hasta 3 h antes. Empleado: su agenda. Dueño: todos.';

-- ─── Barbero: reservar para un cliente y bloquear ───────────────────────────
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
      if v_turno.cliente_id is distinct from p_cliente_id then
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

create or replace function public.bloquear_horario(
  p_barbero uuid,
  p_inicio timestamptz,
  p_fin timestamptz,
  p_nota text default null,
  p_solicitud_id uuid default null
)
returns public.turnos
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_turno public.turnos;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  perform public._exigir_agenda(p_barbero);

  if p_solicitud_id is not null then
    select * into v_turno from public.turnos where solicitud_id = p_solicitud_id;
    if found then
      if v_turno.barbero_id <> p_barbero or v_turno.tipo <> 'bloqueo' then
        raise exception using errcode = 'P0001', message = 'solicitud_invalida',
          hint = 'La clave de solicitud ya se usó.';
      end if;
      return v_turno;
    end if;
  end if;

  if p_inicio is null or p_fin is null or p_fin <= p_inicio
     or p_fin - p_inicio > interval '12 hours' or (v_nota is not null and char_length(v_nota) > 120) then
    raise exception using errcode = '22023', message = 'datos_invalidos',
      hint = 'Revisá el horario a bloquear.';
  end if;

  if p_fin <= public._ahora() then
    raise exception using errcode = 'P0001', message = 'horario_pasado',
      hint = 'Ese horario ya pasó.';
  end if;

  begin
    insert into public.turnos (barbero_id, cliente_id, tipo, inicio, fin, nota, creado_por, solicitud_id)
    values (p_barbero, null, 'bloqueo', p_inicio, p_fin, v_nota, (select auth.uid()), p_solicitud_id)
    returning * into v_turno;
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'horario_ocupado',
      hint = 'En ese horario ya hay un turno.';
  end;

  return v_turno;
end;
$$;

comment on function public.bloquear_horario(uuid, timestamptz, timestamptz, text, uuid) is
  'Bloquea un horario de la agenda (nadie lo puede reservar). Se quita con cancelar_turno.';

-- ─── Barbero: horario semanal y días especiales ─────────────────────────────
-- p_franjas: [{ "dia_semana": 1, "desde": "10:00", "hasta": "13:00", "duracion_min": 30 }, …]
create or replace function public.guardar_horario_semanal(p_barbero uuid, p_franjas jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public._exigir_agenda(p_barbero);

  if p_franjas is null or jsonb_typeof(p_franjas) <> 'array' or jsonb_array_length(p_franjas) > 100 then
    raise exception using errcode = '22023', message = 'franjas_invalidas',
      hint = 'El horario no tiene un formato válido.';
  end if;

  begin
    delete from public.horarios_semanales where barbero_id = p_barbero;
    insert into public.horarios_semanales (barbero_id, dia_semana, desde, hasta, duracion_min)
    select
      p_barbero,
      (f ->> 'dia_semana')::smallint,
      (f ->> 'desde')::time,
      (f ->> 'hasta')::time,
      (f ->> 'duracion_min')::smallint
    from jsonb_array_elements(p_franjas) f;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'franjas_superpuestas',
        hint = 'Hay franjas que se superponen en el mismo día.';
    when check_violation or not_null_violation or invalid_datetime_format
      or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'franjas_invalidas',
        hint = 'Revisá las franjas: horas en punto o y media, y que entre al menos un turno.';
  end;
end;
$$;

comment on function public.guardar_horario_semanal(uuid, jsonb) is
  'Reemplaza el horario semanal de un barbero. El empleado, el suyo; el dueño, el de cualquiera. No toca turnos ya tomados.';

-- p_franjas vacío = cerrado ese día. Con franjas = horario distinto.
create or replace function public.guardar_dia_especial(
  p_barbero uuid,
  p_fecha date,
  p_franjas jsonb,
  p_motivo text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  perform public._exigir_agenda(p_barbero);

  if p_fecha is null or p_fecha < public._hoy_turnos() or p_fecha > public._hoy_turnos() + 366 then
    raise exception using errcode = '22023', message = 'fecha_invalida',
      hint = 'Elegí una fecha de hoy en adelante.';
  end if;

  if p_franjas is null or jsonb_typeof(p_franjas) <> 'array' or jsonb_array_length(p_franjas) > 20 then
    raise exception using errcode = '22023', message = 'franjas_invalidas',
      hint = 'El horario no tiene un formato válido.';
  end if;

  begin
    delete from public.dias_especiales where barbero_id = p_barbero and fecha = p_fecha;

    if jsonb_array_length(p_franjas) = 0 then
      insert into public.dias_especiales (barbero_id, fecha, cerrado, motivo)
      values (p_barbero, p_fecha, true, v_motivo);
    else
      insert into public.dias_especiales (barbero_id, fecha, cerrado, desde, hasta, duracion_min, motivo)
      select
        p_barbero,
        p_fecha,
        false,
        (f ->> 'desde')::time,
        (f ->> 'hasta')::time,
        (f ->> 'duracion_min')::smallint,
        v_motivo
      from jsonb_array_elements(p_franjas) f;
    end if;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'franjas_superpuestas',
        hint = 'Hay franjas que se superponen.';
    when check_violation or not_null_violation or invalid_datetime_format
      or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'franjas_invalidas',
        hint = 'Revisá las franjas y el motivo (hasta 60 letras).';
  end;
end;
$$;

comment on function public.guardar_dia_especial(uuid, date, jsonb, text) is
  'Día especial de un barbero: cerrado (sin franjas) u horario distinto. Reemplaza al que hubiera esa fecha.';

create or replace function public.borrar_dia_especial(p_barbero uuid, p_fecha date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public._exigir_agenda(p_barbero);
  delete from public.dias_especiales where barbero_id = p_barbero and fecha = p_fecha;
end;
$$;

-- ─── Lecturas ───────────────────────────────────────────────────────────────
-- Próximo turno del cliente (con el nombre del barbero).
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
  order by t.inicio
  limit 1;
$$;

-- Agenda de un día: turnos, bloqueos y horarios libres (que todavía no terminaron).
create or replace function public.agenda_dia(p_barbero uuid, p_fecha date)
returns table (
  tipo text,
  inicio timestamptz,
  fin timestamptz,
  turno_id uuid,
  estado text,
  cliente_id uuid,
  cliente_nombre text,
  cliente_telefono text,
  nota text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz := p_fecha::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_hasta timestamptz := (p_fecha + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';
begin
  perform public._exigir_agenda(p_barbero);

  return query
  select x.tipo, x.inicio, x.fin, x.turno_id, x.estado, x.cliente_id, x.cliente_nombre,
         x.cliente_telefono, x.nota
  from (
    select t.tipo, t.inicio, t.fin, t.id as turno_id, t.estado, t.cliente_id,
           c.nombre as cliente_nombre, c.telefono as cliente_telefono, t.nota
    from public.turnos t
    left join public.perfiles c on c.id = t.cliente_id
    where t.barbero_id = p_barbero
      and t.estado <> 'cancelado'
      and t.inicio >= v_desde and t.inicio < v_hasta
    union all
    select 'libre', s.inicio, s.fin, null, null, null, null, null, null
    from public._slots(p_barbero, p_fecha, p_fecha) s
    where s.fin > public._ahora()
      and not exists (
        select 1 from public.turnos t
        where t.barbero_id = p_barbero
          and t.estado <> 'cancelado'
          and t.rango && tstzrange(s.inicio, s.fin, '[)')
      )
  ) x
  order by x.inicio, x.tipo;
end;
$$;

comment on function public.agenda_dia(uuid, date) is
  'Agenda de un barbero en una fecha: turnos (con nombre y teléfono del cliente), bloqueos y horarios libres.';

-- ─── Notificaciones push ────────────────────────────────────────────────────
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
begin
  perform public._exigir_barbero();

  begin
    -- Si el dispositivo ya estaba suscripto (con otro barbero), pasa a ser de quien lo activa.
    insert into public.suscripciones_push (barbero_id, endpoint, p256dh, auth)
    values ((select auth.uid()), p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update
      set barbero_id = excluded.barbero_id,
          p256dh = excluded.p256dh,
          auth = excluded.auth,
          actualizada_en = now();
  exception when check_violation or not_null_violation then
    raise exception using errcode = '22023', message = 'suscripcion_invalida',
      hint = 'La suscripción del navegador no es válida.';
  end;
end;
$$;

create or replace function public.borrar_suscripcion_push(p_endpoint text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public._exigir_barbero();
  delete from public.suscripciones_push
  where endpoint = p_endpoint and barbero_id = (select auth.uid());
end;
$$;

-- ─── Corte ↔ turno ──────────────────────────────────────────────────────────
-- Al sumar un corte a un cliente que tenía turno cerca de esa hora, el turno
-- queda "atendido" y vinculado al corte. Deshacer el corte lo vuelve a
-- "reservado". Nunca hace fallar el registro del corte.
create or replace function public._vincular_corte_con_turno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    update public.turnos t
    set estado = 'atendido', corte_id = new.id
    where t.id = (
      select x.id
      from public.turnos x
      where x.cliente_id = new.cliente_id
        and x.tipo = 'reserva'
        and x.estado = 'reservado'
        and x.inicio between new.fecha - interval '3 hours' and new.fecha + interval '3 hours'
      order by (x.barbero_id = new.registrado_por) desc nulls last,
               abs(extract(epoch from (x.inicio - new.fecha)))
      limit 1
    );
  exception when others then
    raise warning 'No se pudo vincular el corte % con un turno: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public._desvincular_corte_de_turno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    update public.turnos
    set estado = 'reservado', corte_id = null
    where corte_id = old.id and estado = 'atendido';
  exception when others then
    raise warning 'No se pudo desvincular el corte % de su turno: %', old.id, sqlerrm;
  end;
  return old;
end;
$$;

create trigger cortes_vincula_turno
  after insert on public.cortes
  for each row execute function public._vincular_corte_con_turno();

-- BEFORE: corre antes del "on delete set null" de turnos.corte_id.
create trigger cortes_desvincula_turno
  before delete on public.cortes
  for each row execute function public._desvincular_corte_de_turno();

-- ─── RLS y permisos ─────────────────────────────────────────────────────────
alter table public.horarios_semanales enable row level security;
alter table public.dias_especiales enable row level security;
alter table public.turnos enable row level security;
alter table public.suscripciones_push enable row level security;

revoke all on table
  public.horarios_semanales,
  public.dias_especiales,
  public.turnos,
  public.suscripciones_push
from anon, authenticated;

-- Solo lectura y solo para barberos (por RLS). Todo se escribe por funciones.
grant select on table
  public.horarios_semanales,
  public.dias_especiales,
  public.turnos,
  public.suscripciones_push
to authenticated;

grant all on table
  public.horarios_semanales,
  public.dias_especiales,
  public.turnos,
  public.suscripciones_push
to service_role;

create policy "horarios: el dueño ve todos; el empleado, los suyos"
  on public.horarios_semanales
  for select
  to authenticated
  using ((select public.es_dueno()) or (barbero_id = (select auth.uid()) and (select public.es_barbero())));

create policy "dias especiales: el dueño ve todos; el empleado, los suyos"
  on public.dias_especiales
  for select
  to authenticated
  using ((select public.es_dueno()) or (barbero_id = (select auth.uid()) and (select public.es_barbero())));

-- El cliente no lee la tabla (usa horarios_libres y mi_proximo_turno).
create policy "turnos: el dueño ve todos; el empleado, su agenda"
  on public.turnos
  for select
  to authenticated
  using ((select public.es_dueno()) or (barbero_id = (select auth.uid()) and (select public.es_barbero())));

create policy "suscripciones: cada barbero ve las suyas"
  on public.suscripciones_push
  for select
  to authenticated
  using (barbero_id = (select auth.uid()) and (select public.es_barbero()));

revoke execute on function
  public._ahora(),
  public._hoy_turnos(),
  public._es_barbero_id(uuid),
  public._exigir_agenda(uuid),
  public._franjas_del_dia(uuid, date),
  public._slots(uuid, date, date),
  public._vincular_corte_con_turno(),
  public._desvincular_corte_de_turno(),
  public.horarios_libres(uuid),
  public.barberos_turnos(),
  public.reservar_turno(uuid, timestamptz, uuid),
  public.cancelar_turno(uuid),
  public.reservar_para_cliente(uuid, uuid, timestamptz, uuid),
  public.bloquear_horario(uuid, timestamptz, timestamptz, text, uuid),
  public.guardar_horario_semanal(uuid, jsonb),
  public.guardar_dia_especial(uuid, date, jsonb, text),
  public.borrar_dia_especial(uuid, date),
  public.mi_proximo_turno(),
  public.agenda_dia(uuid, date),
  public.guardar_suscripcion_push(text, text, text),
  public.borrar_suscripcion_push(text)
from public, anon, authenticated;

-- Cada función vuelve a verificar quién llama.
grant execute on function
  public.horarios_libres(uuid),
  public.barberos_turnos(),
  public.reservar_turno(uuid, timestamptz, uuid),
  public.cancelar_turno(uuid),
  public.reservar_para_cliente(uuid, uuid, timestamptz, uuid),
  public.bloquear_horario(uuid, timestamptz, timestamptz, text, uuid),
  public.guardar_horario_semanal(uuid, jsonb),
  public.guardar_dia_especial(uuid, date, jsonb, text),
  public.borrar_dia_especial(uuid, date),
  public.mi_proximo_turno(),
  public.agenda_dia(uuid, date),
  public.guardar_suscripcion_push(text, text, text),
  public.borrar_suscripcion_push(text)
to authenticated;

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- La agenda del barbero escucha los cambios de turnos (Realtime respeta el RLS:
-- el empleado recibe solo los de su agenda; el cliente, ninguno).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.turnos;
  end if;
end;
$$;
