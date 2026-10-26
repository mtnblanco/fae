-- ════════════════════════════════════════════════════════════════════════════
-- Servicios y precios de cada barbero.
--
-- Cada barbero carga los servicios que ofrece (nombre, precio y una
-- descripción corta opcional), con SUS precios: cambian de un barbero a otro.
-- Al sacar turno, el cliente elige el servicio y ve el precio. El servicio NO
-- cambia la duración del turno: la sigue marcando la franja del horario.
--
--   · El barbero maneja los suyos; el dueño (y el admin), los de cualquiera.
--     Se escriben solo con crear_servicio(), editar_servicio(),
--     activar_servicio() y borrar_servicio().
--   · Si el barbero tiene al menos un servicio activo, reservar_turno() exige
--     uno (de ese barbero y activo). Si no tiene, se reserva como siempre.
--   · El turno guarda una copia del servicio (servicio_nombre y
--     servicio_precio): si después cambia el precio, o se borra el servicio,
--     el turno ya reservado no cambia.
--   · Ven los servicios ACTIVOS los usuarios logueados (los clientes, para
--     sacar turno; /turnos exige sesión). Los pausados, solo su barbero y el
--     dueño. Nada para anon.
--
-- Pensada para aplicarse sobre una base EN USO: agrega una tabla y columnas
-- nullable en turnos, y recrea reservar_turno (suma p_servicio al final, con
-- default), mi_proximo_turno y agenda_dia (suman columnas al final). La
-- versión publicada de la app sigue funcionando igual mientras ningún barbero
-- cargue servicios (con servicios, la app vieja no manda cuál y la base pide
-- elegir uno: publicá el código nuevo enseguida).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── servicios ──────────────────────────────────────────────────────────────
-- Mismo tipo y tope que cortes.monto: numeric(12, 2), hasta 9.999.999.
create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.perfiles (id) on delete cascade,
  nombre text not null,
  descripcion text,
  precio numeric(12, 2) not null,
  activo boolean not null default true,
  orden smallint not null default 0,
  creado_en timestamptz not null default now(),

  constraint servicios_nombre_largo check (char_length(btrim(nombre)) between 2 and 60),
  constraint servicios_descripcion_largo check (
    descripcion is null or char_length(btrim(descripcion)) between 1 and 140
  ),
  constraint servicios_precio_valido check (precio > 0 and precio <= 9999999)
);

comment on table public.servicios is
  'Servicios que ofrece cada barbero, con su precio. Los escriben las funciones crear/editar/activar/borrar_servicio.';

create index if not exists servicios_barbero_orden_idx
  on public.servicios (barbero_id, orden, creado_en);

-- Un barbero no repite el nombre de un servicio (sin importar mayúsculas).
create unique index if not exists servicios_barbero_nombre_unico
  on public.servicios (barbero_id, lower(btrim(nombre)));

-- ─── turnos: copia del servicio elegido ─────────────────────────────────────
alter table public.turnos
  add column if not exists servicio_id uuid references public.servicios (id) on delete set null,
  add column if not exists servicio_nombre text,
  add column if not exists servicio_precio numeric(12, 2);

alter table public.turnos
  add constraint turnos_servicio_copia check (
    (servicio_nombre is null) = (servicio_precio is null)
    and (servicio_id is null or servicio_nombre is not null)
  );

comment on column public.turnos.servicio_id is
  'Servicio elegido al reservar. Null si no eligió (barbero sin servicios) o si el servicio se borró.';
comment on column public.turnos.servicio_nombre is
  'Copia del nombre del servicio al reservar (no cambia si después lo editan o lo borran).';
comment on column public.turnos.servicio_precio is
  'Copia del precio del servicio al reservar (no cambia si después cambia el precio).';

-- Para el "on delete set null" al borrar un servicio.
create index if not exists turnos_servicio_idx on public.turnos (servicio_id)
  where servicio_id is not null;

-- ─── Escribir servicios ─────────────────────────────────────────────────────
-- Permisos: los mismos que la agenda (_exigir_agenda): barbero activo, el
-- empleado solo los suyos, el dueño los de cualquiera, y nunca de un admin
-- (no atiende).

-- Valida y normaliza los datos de un servicio. Devuelve (nombre, descripción, precio).
create or replace function public._datos_servicio(
  p_nombre text,
  p_precio numeric,
  p_descripcion text,
  out nombre text,
  out descripcion text,
  out precio numeric
)
language plpgsql
immutable
set search_path = ''
as $$
begin
  nombre := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  descripcion := nullif(btrim(coalesce(p_descripcion, '')), '');
  precio := round(p_precio, 2);

  if char_length(nombre) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'servicio_nombre_invalido',
      hint = 'El nombre tiene que tener entre 2 y 60 letras.';
  end if;
  if descripcion is not null and char_length(descripcion) > 140 then
    raise exception using errcode = '22023', message = 'servicio_descripcion_invalida',
      hint = 'La descripción puede tener hasta 140 letras.';
  end if;
  if precio is null or precio <= 0 or precio > 9999999 then
    raise exception using errcode = '22003', message = 'servicio_precio_invalido',
      hint = 'El precio tiene que ser mayor a 0 y hasta 9.999.999.';
  end if;
end;
$$;

-- El servicio (bloqueado para escribir) y verifica que quien llama lo pueda tocar.
create or replace function public._servicio_para_editar(p_servicio uuid)
returns public.servicios
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_servicio public.servicios;
begin
  perform public._exigir_barbero();
  select * into v_servicio from public.servicios where id = p_servicio for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'servicio_inexistente',
      hint = 'El servicio no existe.';
  end if;
  perform public._exigir_agenda(v_servicio.barbero_id);
  return v_servicio;
end;
$$;

create or replace function public.crear_servicio(
  p_barbero uuid,
  p_nombre text,
  p_precio numeric,
  p_descripcion text default null
)
returns public.servicios
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_datos record;
  v_servicio public.servicios;
begin
  perform public._exigir_agenda(p_barbero);
  select * into v_datos from public._datos_servicio(p_nombre, p_precio, p_descripcion);

  -- Serializa las altas de un mismo barbero (para el tope y el orden).
  perform pg_advisory_xact_lock(hashtextextended('servicios:' || p_barbero::text, 0));

  if (select count(*) from public.servicios where barbero_id = p_barbero) >= 30 then
    raise exception using errcode = 'P0001', message = 'demasiados_servicios',
      hint = 'Cada barbero puede tener hasta 30 servicios.';
  end if;

  begin
    insert into public.servicios (barbero_id, nombre, descripcion, precio, orden)
    values (
      p_barbero, v_datos.nombre, v_datos.descripcion, v_datos.precio,
      (select coalesce(max(s.orden), 0) + 1 from public.servicios s where s.barbero_id = p_barbero)
    )
    returning * into v_servicio;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'servicio_repetido',
      hint = 'Ya hay un servicio con ese nombre.';
  end;

  return v_servicio;
end;
$$;

comment on function public.crear_servicio(uuid, text, numeric, text) is
  'Agrega un servicio a un barbero. El empleado, a sí mismo; el dueño, a cualquiera. Hasta 30 por barbero.';

-- Cambia nombre, precio y descripción. Los turnos ya reservados no cambian (guardan una copia).
create or replace function public.editar_servicio(
  p_servicio uuid,
  p_nombre text,
  p_precio numeric,
  p_descripcion text default null
)
returns public.servicios
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_datos record;
  v_servicio public.servicios;
begin
  perform public._servicio_para_editar(p_servicio);
  select * into v_datos from public._datos_servicio(p_nombre, p_precio, p_descripcion);

  begin
    update public.servicios
    set nombre = v_datos.nombre, descripcion = v_datos.descripcion, precio = v_datos.precio
    where id = p_servicio
    returning * into v_servicio;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'servicio_repetido',
      hint = 'Ya hay un servicio con ese nombre.';
  end;

  return v_servicio;
end;
$$;

comment on function public.editar_servicio(uuid, text, numeric, text) is
  'Edita un servicio. El empleado, los suyos; el dueño, los de cualquiera. No toca los turnos ya reservados.';

-- Pausar (deja de ofrecerse) o volver a ofrecer un servicio.
create or replace function public.activar_servicio(p_servicio uuid, p_activo boolean)
returns public.servicios
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_servicio public.servicios;
begin
  perform public._servicio_para_editar(p_servicio);
  if p_activo is null then
    raise exception using errcode = '22023', message = 'datos_invalidos',
      hint = 'Falta indicar si el servicio queda activo.';
  end if;

  update public.servicios set activo = p_activo where id = p_servicio
  returning * into v_servicio;
  return v_servicio;
end;
$$;

comment on function public.activar_servicio(uuid, boolean) is
  'Pausa o vuelve a ofrecer un servicio. El empleado, los suyos; el dueño, los de cualquiera.';

-- Los turnos que lo tenían conservan la copia (servicio_id queda en null).
create or replace function public.borrar_servicio(p_servicio uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public._servicio_para_editar(p_servicio);
  delete from public.servicios where id = p_servicio;
end;
$$;

comment on function public.borrar_servicio(uuid) is
  'Borra un servicio. Los turnos ya reservados conservan el nombre y el precio que tenían.';

-- ─── reservar_turno: con servicio ───────────────────────────────────────────
-- Suma p_servicio al final (con default): hay que recrearla, porque
-- "create or replace" no cambia la lista de parámetros, y no puede quedar la
-- versión vieja al lado (PostgREST no sabría a cuál llamar). La app vieja la
-- sigue llamando igual (por nombre, sin p_servicio).
-- Mismo cuerpo que 20261025000100_seguridad, más la validación y la copia del servicio.
drop function if exists public.reservar_turno(uuid, timestamptz, uuid);

create function public.reservar_turno(
  p_barbero uuid,
  p_inicio timestamptz,
  p_solicitud_id uuid default null,
  p_servicio uuid default null
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
  v_servicio public.servicios;
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

  -- Servicio: si el barbero ofrece alguno, hay que elegir uno suyo y activo.
  if p_servicio is not null then
    select * into v_servicio
    from public.servicios s
    where s.id = p_servicio and s.barbero_id = p_barbero and s.activo;
    if not found then
      raise exception using errcode = 'P0001', message = 'servicio_no_disponible',
        hint = 'Ese servicio no es de este barbero o ya no se ofrece.';
    end if;
  elsif exists (select 1 from public.servicios s where s.barbero_id = p_barbero and s.activo) then
    raise exception using errcode = 'P0001', message = 'servicio_requerido',
      hint = 'Este barbero pide elegir un servicio.';
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
    insert into public.turnos (
      barbero_id, cliente_id, tipo, inicio, fin, creado_por, solicitud_id,
      servicio_id, servicio_nombre, servicio_precio
    )
    values (
      p_barbero, v_uid, 'reserva', p_inicio, v_fin, v_uid, p_solicitud_id,
      v_servicio.id, v_servicio.nombre, v_servicio.precio
    )
    returning * into v_turno;
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'horario_ocupado',
      hint = 'Ese horario se acaba de ocupar.';
  end;

  return v_turno;
end;
$$;

comment on function public.reservar_turno(uuid, timestamptz, uuid, uuid) is
  'El cliente reserva un horario libre (con un servicio, si el barbero ofrece). 1 h de anticipación, 14 días, 1 turno activo, hasta 5 reservas cada 24 h. Idempotente por solicitud.';

-- ─── mi_proximo_turno: con el servicio ──────────────────────────────────────
-- Suma servicio_nombre y servicio_precio al final: cambia el tipo de retorno,
-- hay que recrearla. Mismo cuerpo que 20261028000100_cancelar_6_horas.
drop function if exists public.mi_proximo_turno();

create function public.mi_proximo_turno()
returns table (
  id uuid,
  barbero_id uuid,
  barbero_nombre text,
  inicio timestamptz,
  fin timestamptz,
  puede_cancelar boolean,
  servicio_nombre text,
  servicio_precio numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.barbero_id, b.nombre, t.inicio, t.fin,
         t.inicio - public._ahora() > interval '6 hours',
         t.servicio_nombre, t.servicio_precio
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

comment on function public.mi_proximo_turno() is
  'Próximo turno del cliente: barbero, horario, servicio elegido (copia) y si todavía lo puede cancelar.';

-- ─── agenda_dia: con el servicio ────────────────────────────────────────────
-- Suma servicio_nombre y servicio_precio al final. Mismo cuerpo que 20261023000200_turnos.
drop function if exists public.agenda_dia(uuid, date);

create function public.agenda_dia(p_barbero uuid, p_fecha date)
returns table (
  tipo text,
  inicio timestamptz,
  fin timestamptz,
  turno_id uuid,
  estado text,
  cliente_id uuid,
  cliente_nombre text,
  cliente_telefono text,
  nota text,
  servicio_nombre text,
  servicio_precio numeric
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
         x.cliente_telefono, x.nota, x.servicio_nombre, x.servicio_precio
  from (
    select t.tipo, t.inicio, t.fin, t.id as turno_id, t.estado, t.cliente_id,
           c.nombre as cliente_nombre, c.telefono as cliente_telefono, t.nota,
           t.servicio_nombre, t.servicio_precio
    from public.turnos t
    left join public.perfiles c on c.id = t.cliente_id
    where t.barbero_id = p_barbero
      and t.estado <> 'cancelado'
      and t.inicio >= v_desde and t.inicio < v_hasta
    union all
    select 'libre', s.inicio, s.fin, null, null, null, null, null, null, null, null
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
  'Agenda de un barbero en una fecha: turnos (con nombre y teléfono del cliente, y el servicio), bloqueos y horarios libres.';

-- ─── RLS y permisos ─────────────────────────────────────────────────────────
alter table public.servicios enable row level security;

revoke all on table public.servicios from anon, authenticated;
-- Solo lectura (por RLS). Todo se escribe por funciones.
grant select on table public.servicios to authenticated;
grant all on table public.servicios to service_role;

drop policy if exists "servicios: activos para todos; pausados, su barbero y el dueño"
  on public.servicios;
create policy "servicios: activos para todos; pausados, su barbero y el dueño"
  on public.servicios
  for select
  to authenticated
  using (
    activo
    or (select public.es_dueno())
    or (barbero_id = (select auth.uid()) and (select public.es_barbero()))
  );

revoke execute on function
  public._datos_servicio(text, numeric, text),
  public._servicio_para_editar(uuid),
  public.crear_servicio(uuid, text, numeric, text),
  public.editar_servicio(uuid, text, numeric, text),
  public.activar_servicio(uuid, boolean),
  public.borrar_servicio(uuid),
  public.reservar_turno(uuid, timestamptz, uuid, uuid),
  public.mi_proximo_turno(),
  public.agenda_dia(uuid, date)
from public, anon, authenticated;

-- Cada función vuelve a verificar quién llama.
grant execute on function
  public.crear_servicio(uuid, text, numeric, text),
  public.editar_servicio(uuid, text, numeric, text),
  public.activar_servicio(uuid, boolean),
  public.borrar_servicio(uuid),
  public.reservar_turno(uuid, timestamptz, uuid, uuid),
  public.mi_proximo_turno(),
  public.agenda_dia(uuid, date)
to authenticated;
