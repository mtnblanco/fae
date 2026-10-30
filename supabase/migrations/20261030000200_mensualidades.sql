-- ════════════════════════════════════════════════════════════════════════════
-- Mensualidades: 4 cortes por un precio fijo.
--
--   · Cada barbero tiene su precio de mensualidad (perfiles.precio_mensualidad).
--   · Cualquier barbero cobra la mensualidad a un cliente (con su medio de
--     pago): entra a la caja a nombre de quien la cobró.
--   · Cada corte del cliente mensual usa uno de los 4 (cortes_mensualidad). NO
--     suma sellos: por eso no va en `cortes`, que es la tarjeta de premios.
--   · No vence: al usar el 4.º vuelve a ser cliente común hasta que vuelva a
--     pagar. Una sola mensualidad activa por cliente.
--
-- Pensada para aplicarse sobre una base EN USO, ANTES de publicar la app: solo
-- agrega tablas, funciones y columnas. facturacion() suma columnas al final y
-- movimientos_caja() mantiene su forma (suma tipos de movimiento).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── perfiles.precio_mensualidad ────────────────────────────────────────────
alter table public.perfiles add column if not exists precio_mensualidad numeric(12, 2);

alter table public.perfiles drop constraint if exists perfiles_precio_mensualidad_valido;
alter table public.perfiles
  add constraint perfiles_precio_mensualidad_valido check (
    precio_mensualidad is null
    or (rol = 'barbero' and precio_mensualidad > 0 and precio_mensualidad <= 9999999)
  );

comment on column public.perfiles.precio_mensualidad is
  'Solo barberos: lo que cobra por la mensualidad (4 cortes). Se precarga al cobrarla. Null = sin precio.';

-- ─── mensualidades ──────────────────────────────────────────────────────────
create table if not exists public.mensualidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfiles (id) on delete cascade,
  -- Quién la cobró (la caja se la cuenta a él). Null si se eliminó al barbero.
  barbero_id uuid references public.perfiles (id) on delete set null,
  monto numeric(12, 2) not null,
  medio_pago text not null,
  cortes_incluidos smallint not null default 4,
  fecha timestamptz not null default now(),
  solicitud_id uuid unique,

  constraint mensualidades_monto_valido check (monto > 0 and monto <= 9999999),
  constraint mensualidades_medio_valido check (medio_pago in ('efectivo', 'transferencia')),
  constraint mensualidades_cortes_validos check (cortes_incluidos between 1 and 30)
);

comment on table public.mensualidades is
  'Mensualidades cobradas: N cortes (4) por un precio. Activa mientras le queden cortes. Se cobran con cobrar_mensualidad().';

create index if not exists mensualidades_cliente_fecha_idx
  on public.mensualidades (cliente_id, fecha desc);
create index if not exists mensualidades_fecha_idx on public.mensualidades (fecha desc);
create index if not exists mensualidades_barbero_idx on public.mensualidades (barbero_id);

-- ─── cortes_mensualidad ─────────────────────────────────────────────────────
create table if not exists public.cortes_mensualidad (
  id uuid primary key default gen_random_uuid(),
  mensualidad_id uuid not null references public.mensualidades (id) on delete cascade,
  cliente_id uuid not null references public.perfiles (id) on delete cascade,
  fecha timestamptz not null default now(),
  registrado_por uuid references public.perfiles (id) on delete set null,
  solicitud_id uuid unique
);

comment on table public.cortes_mensualidad is
  'Cortes hechos con la mensualidad (no suman sellos). Se cargan con usar_corte_mensualidad().';

create index if not exists cortes_mensualidad_mensualidad_idx
  on public.cortes_mensualidad (mensualidad_id, fecha);
create index if not exists cortes_mensualidad_cliente_fecha_idx
  on public.cortes_mensualidad (cliente_id, fecha desc);
create index if not exists cortes_mensualidad_fecha_idx on public.cortes_mensualidad (fecha desc);
create index if not exists cortes_mensualidad_registrado_idx
  on public.cortes_mensualidad (registrado_por);

-- Un corte de mensualidad también atiende el turno (como un corte común).
alter table public.turnos
  add column if not exists corte_mensual_id uuid unique
    references public.cortes_mensualidad (id) on delete set null;

comment on column public.turnos.corte_mensual_id is
  'Corte de mensualidad que atendió este turno (en lugar de corte_id).';

-- ─── Helpers ────────────────────────────────────────────────────────────────
-- Mensualidad activa del cliente (le quedan cortes), o null.
create or replace function public._mensualidad_activa(p_cliente uuid)
returns public.mensualidades
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
  from public.mensualidades m
  where m.cliente_id = p_cliente
    and (select count(*) from public.cortes_mensualidad c where c.mensualidad_id = m.id)
      < m.cortes_incluidos
  order by m.fecha desc
  limit 1;
$$;

create or replace function public._exigir_cliente(p_cliente uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.perfiles where id = p_cliente and rol = 'cliente') then
    raise exception using errcode = 'P0002', message = 'cliente_inexistente',
      hint = 'El cliente no existe.';
  end if;
end;
$$;

-- ─── Precio de cada barbero ─────────────────────────────────────────────────
create or replace function public.guardar_precio_mensualidad(p_barbero uuid, p_precio numeric)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_precio numeric := round(p_precio, 2);
begin
  perform public._exigir_agenda(p_barbero);
  if v_precio is not null and (v_precio <= 0 or v_precio > 9999999) then
    raise exception using errcode = '22003', message = 'monto_invalido',
      hint = 'El precio tiene que ser mayor a 0 y hasta 9.999.999.';
  end if;
  update public.perfiles set precio_mensualidad = v_precio where id = p_barbero;
  return v_precio;
end;
$$;

comment on function public.guardar_precio_mensualidad(uuid, numeric) is
  'Precio de la mensualidad de un barbero (null = sin precio). El empleado, el suyo; el dueño, el de cualquiera.';

-- ─── Estado de la mensualidad de un cliente ─────────────────────────────────
-- Para la ficha, el escáner y el carnet. Lo puede pedir un barbero o el
-- propio cliente. Siempre devuelve una fila (activa = false si no tiene).
create or replace function public.estado_mensualidad(p_cliente uuid)
returns table (
  activa boolean,
  mensualidad_id uuid,
  cortes_incluidos integer,
  cortes_usados integer,
  usos timestamptz[],
  desde timestamptz,
  -- Precio de mensualidad de quien pregunta (si es barbero), para precargarlo.
  precio_barbero numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.mensualidades;
  v_usos timestamptz[];
begin
  if not (public.es_barbero() or p_cliente = (select auth.uid())) then
    raise exception using errcode = '42501', message = 'no_autorizado',
      hint = 'Solo el barbero o el propio cliente.';
  end if;

  v_m := public._mensualidad_activa(p_cliente);
  if v_m.id is not null then
    select coalesce(array_agg(c.fecha order by c.fecha), '{}') into v_usos
    from public.cortes_mensualidad c where c.mensualidad_id = v_m.id;
  end if;

  return query select
    v_m.id is not null,
    v_m.id,
    v_m.cortes_incluidos::integer,
    coalesce(cardinality(v_usos), 0),
    coalesce(v_usos, '{}'),
    v_m.fecha,
    (select p.precio_mensualidad from public.perfiles p
     where p.id = (select auth.uid()) and p.rol = 'barbero');
end;
$$;

comment on function public.estado_mensualidad(uuid) is
  'Mensualidad activa de un cliente (cortes usados y cuándo) y el precio de quien pregunta. Barberos o el propio cliente.';

-- ─── cobrar_mensualidad ─────────────────────────────────────────────────────
create or replace function public.cobrar_mensualidad(
  p_cliente uuid,
  p_monto numeric,
  p_medio_pago text,
  p_solicitud_id uuid default null
)
returns public.mensualidades
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m public.mensualidades;
begin
  perform public._exigir_barbero();
  perform public._exigir_cliente(p_cliente);

  if p_monto is null or round(p_monto, 2) <= 0 or p_monto > 9999999 then
    raise exception using errcode = '22003', message = 'monto_invalido',
      hint = 'El monto tiene que ser mayor a 0 y hasta 9.999.999.';
  end if;
  if p_medio_pago is null then
    raise exception using errcode = '22023', message = 'medio_pago_invalido',
      hint = 'Falta el medio de pago.';
  end if;
  perform public._validar_medio_pago(p_medio_pago);

  perform public._bloquear_cliente(p_cliente);

  if p_solicitud_id is not null then
    select * into v_m from public.mensualidades where solicitud_id = p_solicitud_id;
    if found then
      if v_m.cliente_id <> p_cliente then
        raise exception using errcode = 'P0001', message = 'solicitud_invalida',
          hint = 'La clave de solicitud ya se usó para otro cliente.';
      end if;
      return v_m;
    end if;
  end if;

  if (public._mensualidad_activa(p_cliente)).id is not null then
    raise exception using errcode = 'P0001', message = 'mensualidad_activa',
      hint = 'El cliente todavía tiene cortes de su mensualidad.';
  end if;

  insert into public.mensualidades (cliente_id, barbero_id, monto, medio_pago, solicitud_id)
  values (p_cliente, (select auth.uid()), round(p_monto, 2), p_medio_pago, p_solicitud_id)
  returning * into v_m;

  return v_m;
end;
$$;

comment on function public.cobrar_mensualidad(uuid, numeric, text, uuid) is
  'Cobra una mensualidad (4 cortes) a un cliente que no tiene una activa. Cualquier barbero. Idempotente por solicitud.';

-- ─── usar_corte_mensualidad ─────────────────────────────────────────────────
create or replace function public.usar_corte_mensualidad(
  p_cliente uuid,
  p_solicitud_id uuid default null
)
returns public.cortes_mensualidad
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m public.mensualidades;
  v_c public.cortes_mensualidad;
begin
  perform public._exigir_barbero();
  perform public._bloquear_cliente(p_cliente);

  if p_solicitud_id is not null then
    select * into v_c from public.cortes_mensualidad where solicitud_id = p_solicitud_id;
    if found then
      if v_c.cliente_id <> p_cliente then
        raise exception using errcode = 'P0001', message = 'solicitud_invalida',
          hint = 'La clave de solicitud ya se usó para otro cliente.';
      end if;
      return v_c;
    end if;
  end if;

  v_m := public._mensualidad_activa(p_cliente);
  if v_m.id is null then
    raise exception using errcode = 'P0001', message = 'sin_mensualidad',
      hint = 'El cliente no tiene una mensualidad con cortes disponibles.';
  end if;

  -- Anti doble registro (por ejemplo, escanear dos veces el mismo QR).
  if exists (
    select 1 from public.cortes_mensualidad
    where cliente_id = p_cliente and fecha > now() - interval '60 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'corte_reciente',
      hint = 'Ya se registró un corte a este cliente hace menos de un minuto.';
  end if;

  insert into public.cortes_mensualidad (mensualidad_id, cliente_id, registrado_por, solicitud_id)
  values (v_m.id, p_cliente, (select auth.uid()), p_solicitud_id)
  returning * into v_c;

  return v_c;
end;
$$;

comment on function public.usar_corte_mensualidad(uuid, uuid) is
  'Usa un corte de la mensualidad activa del cliente (no suma sellos). Solo barberos. Idempotente por solicitud.';

-- ─── Deshacer ───────────────────────────────────────────────────────────────
-- Mismas reglas que deshacer_corte: el empleado, lo que cargó él dentro de los
-- 10 minutos; el dueño, cualquiera dentro de los 10 minutos o del mismo día.
create or replace function public._exigir_plazo_deshacer(p_fecha timestamptz, p_registrado uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dueno boolean := public.es_dueno();
begin
  if not v_dueno and p_registrado is distinct from (select auth.uid()) then
    raise exception using errcode = '42501', message = 'mensualidad_ajena',
      hint = 'El empleado solo puede deshacer lo que cargó él.';
  end if;
  if p_fecha < now() - interval '10 minutes' and not (
    v_dueno
    and (p_fecha at time zone 'America/Argentina/Buenos_Aires')::date
      = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  ) then
    raise exception using errcode = 'P0001', message = 'mensualidad_fuera_de_plazo',
      hint = 'El empleado deshace dentro de los 10 minutos; el dueño, en el mismo día.';
  end if;
end;
$$;

create or replace function public.deshacer_corte_mensualidad(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_c public.cortes_mensualidad;
begin
  perform public._exigir_barbero();
  select * into v_c from public.cortes_mensualidad where id = p_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'corte_inexistente',
      hint = 'El corte no existe o ya se deshizo.';
  end if;
  perform public._exigir_plazo_deshacer(v_c.fecha, v_c.registrado_por);
  perform public._bloquear_cliente(v_c.cliente_id);

  -- Si ya pagó otra mensualidad después, devolver este corte dejaría dos activas.
  if exists (
    select 1 from public.mensualidades m
    where m.cliente_id = v_c.cliente_id
      and m.fecha > (select x.fecha from public.mensualidades x where x.id = v_c.mensualidad_id)
  ) then
    raise exception using errcode = 'P0001', message = 'mensualidad_renovada',
      hint = 'El cliente ya pagó otra mensualidad.';
  end if;

  delete from public.cortes_mensualidad where id = p_id;
end;
$$;

comment on function public.deshacer_corte_mensualidad(uuid) is
  'Devuelve un corte a la mensualidad. Mismos plazos que deshacer_corte.';

create or replace function public.deshacer_mensualidad(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m public.mensualidades;
begin
  perform public._exigir_barbero();
  select * into v_m from public.mensualidades where id = p_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'mensualidad_inexistente',
      hint = 'La mensualidad no existe o ya se deshizo.';
  end if;
  perform public._exigir_plazo_deshacer(v_m.fecha, v_m.barbero_id);
  perform public._bloquear_cliente(v_m.cliente_id);

  if exists (select 1 from public.cortes_mensualidad where mensualidad_id = p_id) then
    raise exception using errcode = 'P0001', message = 'mensualidad_usada',
      hint = 'Ya se usaron cortes de esta mensualidad.';
  end if;

  delete from public.mensualidades where id = p_id;
end;
$$;

comment on function public.deshacer_mensualidad(uuid) is
  'Borra una mensualidad cobrada por error, si todavía no se usó ningún corte. Mismos plazos que deshacer_corte.';

-- ─── Corte de mensualidad ↔ turno ───────────────────────────────────────────
-- Como con los cortes comunes: el turno de esa hora queda "atendido".
create or replace function public._vincular_corte_mensual_con_turno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    update public.turnos t
    set estado = 'atendido', corte_mensual_id = new.id
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
    raise warning 'No se pudo vincular el corte de mensualidad % con un turno: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

create or replace function public._desvincular_corte_mensual_de_turno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    update public.turnos
    set estado = 'reservado', corte_mensual_id = null
    where corte_mensual_id = old.id and estado = 'atendido';
  exception when others then
    raise warning 'No se pudo desvincular el corte de mensualidad % de su turno: %', old.id, sqlerrm;
  end;
  return old;
end;
$$;

drop trigger if exists cortes_mensualidad_vincula_turno on public.cortes_mensualidad;
create trigger cortes_mensualidad_vincula_turno
  after insert on public.cortes_mensualidad
  for each row execute function public._vincular_corte_mensual_con_turno();

drop trigger if exists cortes_mensualidad_desvincula_turno on public.cortes_mensualidad;
create trigger cortes_mensualidad_desvincula_turno
  before delete on public.cortes_mensualidad
  for each row execute function public._desvincular_corte_mensual_de_turno();

-- ─── facturacion: suma las mensualidades ────────────────────────────────────
-- Cambia el tipo de retorno (columnas nuevas al final): hay que recrearla.
--   · total / efectivo / transferencia: también lo cobrado por mensualidades
--     (a nombre de quien la cobró).
--   · mensualidades: cuántas cobró. cortes_mensuales: cuántos cortes hizo con
--     mensualidad (no suman plata: ya se cobraron con la mensualidad).
drop function if exists public.facturacion(date, date);

create function public.facturacion(p_desde date, p_hasta date)
returns table (
  barbero_id uuid,
  barbero_nombre text,
  es_dueno boolean,
  cortes integer,
  cortes_sin_monto integer,
  total numeric,
  es_admin boolean,
  servicios integer,
  efectivo numeric,
  transferencia numeric,
  mensualidades integer,
  cortes_mensuales integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_desde timestamptz := p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_hasta timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';
begin
  perform public._exigir_dueno();

  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 3700 then
    raise exception using errcode = '22023', message = 'periodo_invalido',
      hint = 'El período no es válido.';
  end if;

  return query
  with m as (
    select co.registrado_por as barbero, 'corte'::text as tipo, co.monto, co.medio_pago
    from public.cortes co
    where co.fecha >= v_desde and co.fecha < v_hasta
    union all
    select sh.barbero_id, 'servicio', sh.monto, sh.medio_pago
    from public.servicios_hechos sh
    where sh.fecha >= v_desde and sh.fecha < v_hasta
    union all
    select me.barbero_id, 'mensualidad', me.monto, me.medio_pago
    from public.mensualidades me
    where me.fecha >= v_desde and me.fecha < v_hasta
    union all
    select cm.registrado_por, 'mensual', null::numeric, null::text
    from public.cortes_mensualidad cm
    where cm.fecha >= v_desde and cm.fecha < v_hasta
  ),
  por_barbero as (
    select
      b.id as barbero_id,
      b.nombre as barbero_nombre,
      b.es_dueno,
      (count(m.barbero) filter (where m.tipo = 'corte'))::integer as cortes,
      (count(m.barbero) filter (where m.tipo = 'corte' and m.monto is null))::integer as cortes_sin_monto,
      coalesce(sum(m.monto), 0)::numeric as total,
      b.es_admin,
      (count(m.barbero) filter (where m.tipo = 'servicio'))::integer as servicios,
      coalesce(sum(m.monto) filter (where m.medio_pago = 'efectivo'), 0)::numeric as efectivo,
      coalesce(sum(m.monto) filter (where m.medio_pago = 'transferencia'), 0)::numeric as transferencia,
      (count(m.barbero) filter (where m.tipo = 'mensualidad'))::integer as mensualidades,
      (count(m.barbero) filter (where m.tipo = 'mensual'))::integer as cortes_mensuales
    from public.perfiles b
    left join m on m.barbero = b.id
    where b.rol = 'barbero'
    group by b.id, b.nombre, b.es_dueno, b.es_admin
    -- Los barberos que atienden aparecen siempre; el admin, solo si cargó algo.
    having not b.es_admin or count(m.barbero) > 0
  ),
  sin_barbero as (
    select
      null::uuid as barbero_id,
      null::text as barbero_nombre,
      false as es_dueno,
      (count(*) filter (where m.tipo = 'corte'))::integer as cortes,
      (count(*) filter (where m.tipo = 'corte' and m.monto is null))::integer as cortes_sin_monto,
      coalesce(sum(m.monto), 0)::numeric as total,
      false as es_admin,
      (count(*) filter (where m.tipo = 'servicio'))::integer as servicios,
      coalesce(sum(m.monto) filter (where m.medio_pago = 'efectivo'), 0)::numeric as efectivo,
      coalesce(sum(m.monto) filter (where m.medio_pago = 'transferencia'), 0)::numeric as transferencia,
      (count(*) filter (where m.tipo = 'mensualidad'))::integer as mensualidades,
      (count(*) filter (where m.tipo = 'mensual'))::integer as cortes_mensuales
    from m
    where m.barbero is null
    having count(*) > 0
  )
  select x.barbero_id, x.barbero_nombre, x.es_dueno, x.cortes, x.cortes_sin_monto, x.total,
         x.es_admin, x.servicios, x.efectivo, x.transferencia, x.mensualidades, x.cortes_mensuales
  from (
    select * from por_barbero
    union all
    select * from sin_barbero
  ) x
  order by x.barbero_id is null, x.es_admin, x.es_dueno desc, x.barbero_nombre;
end;
$$;

comment on function public.facturacion(date, date) is
  'Cortes, servicios sin cliente, mensualidades y total cobrado (en efectivo y por transferencia) por barbero entre dos fechas (inclusive, hora argentina). Solo el dueño.';

-- ─── movimientos_caja: suma mensualidades y cortes de mensualidad ───────────
--   · tipo 'mensualidad': el cobro (servicio "Mensualidad (4 cortes)").
--   · tipo 'mensual': cada corte hecho con la mensualidad, sin monto
--     (servicio "Corte de mensualidad 2/4").
create or replace function public.movimientos_caja(p_desde date, p_hasta date)
returns table (
  tipo text,
  id uuid,
  fecha timestamptz,
  barbero_id uuid,
  barbero_nombre text,
  cliente_id uuid,
  cliente_nombre text,
  servicio_nombre text,
  monto numeric,
  medio_pago text,
  registrado_por uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz := p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_hasta timestamptz := (p_hasta + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires';
begin
  perform public._exigir_dueno();

  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 3700 then
    raise exception using errcode = '22023', message = 'periodo_invalido',
      hint = 'El período no es válido.';
  end if;

  return query
  select x.* from (
    select
      'corte'::text,
      co.id,
      co.fecha,
      co.registrado_por,
      b.nombre,
      co.cliente_id,
      c.nombre,
      t.servicio_nombre,
      co.monto,
      co.medio_pago,
      co.registrado_por
    from public.cortes co
    left join public.perfiles b on b.id = co.registrado_por
    left join public.perfiles c on c.id = co.cliente_id
    left join public.turnos t on t.corte_id = co.id
    where co.fecha >= v_desde and co.fecha < v_hasta
    union all
    select
      'servicio'::text,
      sh.id,
      sh.fecha,
      sh.barbero_id,
      b.nombre,
      null::uuid,
      sh.nota,
      sh.servicio_nombre,
      sh.monto,
      sh.medio_pago,
      sh.registrado_por
    from public.servicios_hechos sh
    left join public.perfiles b on b.id = sh.barbero_id
    where sh.fecha >= v_desde and sh.fecha < v_hasta
    union all
    select
      'mensualidad'::text,
      me.id,
      me.fecha,
      me.barbero_id,
      b.nombre,
      me.cliente_id,
      c.nombre,
      format('Mensualidad (%s cortes)', me.cortes_incluidos),
      me.monto,
      me.medio_pago,
      me.barbero_id
    from public.mensualidades me
    left join public.perfiles b on b.id = me.barbero_id
    left join public.perfiles c on c.id = me.cliente_id
    where me.fecha >= v_desde and me.fecha < v_hasta
    union all
    select
      'mensual'::text,
      cm.id,
      cm.fecha,
      cm.registrado_por,
      b.nombre,
      cm.cliente_id,
      c.nombre,
      format('Corte de mensualidad %s/%s', cm.numero, me.cortes_incluidos),
      null::numeric,
      null::text,
      cm.registrado_por
    from (
      select x.*, row_number() over (partition by x.mensualidad_id order by x.fecha, x.id) as numero
      from public.cortes_mensualidad x
    ) cm
    join public.mensualidades me on me.id = cm.mensualidad_id
    left join public.perfiles b on b.id = cm.registrado_por
    left join public.perfiles c on c.id = cm.cliente_id
    where cm.fecha >= v_desde and cm.fecha < v_hasta
  ) x
  order by x.fecha desc, x.id;
end;
$$;

comment on function public.movimientos_caja(date, date) is
  'Cortes, servicios sin cliente, mensualidades y cortes de mensualidad de un período (inclusive, hora argentina), con barbero, servicio, monto y medio de pago. Solo el dueño.';

-- ─── RLS y permisos ─────────────────────────────────────────────────────────
alter table public.mensualidades enable row level security;
alter table public.cortes_mensualidad enable row level security;

revoke all on table public.mensualidades, public.cortes_mensualidad from anon, authenticated;
-- Solo lectura (por RLS). Todo se escribe por funciones.
grant select on table public.mensualidades, public.cortes_mensualidad to authenticated;
grant all on table public.mensualidades, public.cortes_mensualidad to service_role;

drop policy if exists "mensualidades: el cliente ve las suyas; el dueño, todas; el empleado, las que cobró"
  on public.mensualidades;
create policy "mensualidades: el cliente ve las suyas; el dueño, todas; el empleado, las que cobró"
  on public.mensualidades
  for select
  to authenticated
  using (
    cliente_id = (select auth.uid())
    or (select public.es_dueno())
    or (barbero_id = (select auth.uid()) and (select public.es_barbero()))
  );

drop policy if exists "cortes de mensualidad: el cliente ve los suyos; el dueño, todos; el empleado, los que cargó"
  on public.cortes_mensualidad;
create policy "cortes de mensualidad: el cliente ve los suyos; el dueño, todos; el empleado, los que cargó"
  on public.cortes_mensualidad
  for select
  to authenticated
  using (
    cliente_id = (select auth.uid())
    or (select public.es_dueno())
    or (registrado_por = (select auth.uid()) and (select public.es_barbero()))
  );

-- El carnet del cliente se actualiza en vivo al usar un corte o pagar.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.mensualidades, public.cortes_mensualidad;
  end if;
end;
$$;

revoke execute on function
  public._mensualidad_activa(uuid),
  public._exigir_cliente(uuid),
  public._exigir_plazo_deshacer(timestamptz, uuid),
  public._vincular_corte_mensual_con_turno(),
  public._desvincular_corte_mensual_de_turno(),
  public.guardar_precio_mensualidad(uuid, numeric),
  public.estado_mensualidad(uuid),
  public.cobrar_mensualidad(uuid, numeric, text, uuid),
  public.usar_corte_mensualidad(uuid, uuid),
  public.deshacer_corte_mensualidad(uuid),
  public.deshacer_mensualidad(uuid),
  public.facturacion(date, date),
  public.movimientos_caja(date, date)
from public, anon, authenticated;

-- Cada función vuelve a verificar quién llama.
grant execute on function
  public.guardar_precio_mensualidad(uuid, numeric),
  public.estado_mensualidad(uuid),
  public.cobrar_mensualidad(uuid, numeric, text, uuid),
  public.usar_corte_mensualidad(uuid, uuid),
  public.deshacer_corte_mensualidad(uuid),
  public.deshacer_mensualidad(uuid),
  public.facturacion(date, date),
  public.movimientos_caja(date, date)
to authenticated;
