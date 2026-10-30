-- ════════════════════════════════════════════════════════════════════════════
-- Cobros: medio de pago, servicios sin cliente y exportación para el contador.
--
--   · Cada corte guarda cómo se pagó (efectivo o transferencia).
--   · Los barberos registran servicios hechos a alguien que no es cliente
--     registrado (no suma sellos): servicio, monto y medio de pago.
--   · La caja suma las dos cosas y separa efectivo de transferencia.
--   · movimientos_caja() lista todo lo cobrado en un período (para la caja y
--     para exportar el informe del contador). Solo el dueño.
--
-- Pensada para aplicarse sobre una base EN USO, ANTES de publicar la app:
--   · Los cortes que ya había quedan con medio de pago null ("sin dato").
--   · registrar_corte suma p_medio_pago opcional: la app publicada la sigue
--     llamando igual.
--   · facturacion() suma columnas al final: la app publicada las ignora.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── cortes.medio_pago ──────────────────────────────────────────────────────
alter table public.cortes add column if not exists medio_pago text;

alter table public.cortes drop constraint if exists cortes_medio_pago_valido;
alter table public.cortes
  add constraint cortes_medio_pago_valido
    check (medio_pago is null or (medio_pago in ('efectivo', 'transferencia') and monto > 0));

comment on column public.cortes.medio_pago is
  'efectivo o transferencia. Null si no se cobró (sin monto) o en los cortes anteriores a esta función.';

-- ─── servicios_hechos ───────────────────────────────────────────────────────
-- Servicios cobrados a alguien que no es cliente registrado. No suman sellos.
create table if not exists public.servicios_hechos (
  id uuid primary key default gen_random_uuid(),
  -- Quién hizo el servicio (null si después se eliminó al barbero).
  barbero_id uuid references public.perfiles (id) on delete set null,
  servicio_id uuid references public.servicios (id) on delete set null,
  -- Copia del nombre: no cambia si después editan o borran el servicio.
  servicio_nombre text not null,
  monto numeric(12, 2) not null,
  medio_pago text not null,
  nota text,
  fecha timestamptz not null default now(),
  -- Quién lo cargó (el dueño puede cargarlo por otro barbero).
  registrado_por uuid references public.perfiles (id) on delete set null,
  solicitud_id uuid unique,

  constraint servicios_hechos_nombre_largo check (char_length(servicio_nombre) between 2 and 60),
  constraint servicios_hechos_monto_valido check (monto > 0 and monto <= 9999999),
  constraint servicios_hechos_medio_valido check (medio_pago in ('efectivo', 'transferencia')),
  constraint servicios_hechos_nota_largo check (nota is null or char_length(nota) <= 80)
);

comment on table public.servicios_hechos is
  'Servicios cobrados sin cliente registrado (no suman sellos). Se cargan con registrar_servicio_hecho().';

create index if not exists servicios_hechos_fecha_idx on public.servicios_hechos (fecha desc);
create index if not exists servicios_hechos_barbero_fecha_idx
  on public.servicios_hechos (barbero_id, fecha desc);
create index if not exists servicios_hechos_registrado_idx
  on public.servicios_hechos (registrado_por);
create index if not exists servicios_hechos_servicio_idx
  on public.servicios_hechos (servicio_id) where servicio_id is not null;

-- ─── Medio de pago ──────────────────────────────────────────────────────────
create or replace function public._validar_medio_pago(p_medio text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_medio is not null and p_medio not in ('efectivo', 'transferencia') then
    raise exception using errcode = '22023', message = 'medio_pago_invalido',
      hint = 'El medio de pago tiene que ser efectivo o transferencia.';
  end if;
end;
$$;

-- ─── registrar_corte: con medio de pago ─────────────────────────────────────
-- Se reemplaza la versión de 3 parámetros (si convivieran, la API no sabría
-- cuál llamar). Con p_medio_pago opcional, las llamadas viejas siguen igual.
drop function if exists public.registrar_corte(uuid, uuid, numeric);

create function public.registrar_corte(
  p_cliente_id uuid,
  p_solicitud_id uuid default null,
  p_monto numeric default null,
  p_medio_pago text default null
)
returns public.cortes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_corte public.cortes;
begin
  perform public._exigir_barbero();

  if p_monto is not null and (p_monto < 0 or p_monto > 9999999) then
    raise exception using errcode = '22003', message = 'monto_invalido',
      hint = 'El monto tiene que estar entre 0 y 9.999.999.';
  end if;
  perform public._validar_medio_pago(p_medio_pago);

  perform public._bloquear_cliente(p_cliente_id);

  -- Idempotencia: si esta misma solicitud ya se procesó, devolvemos el resultado.
  if p_solicitud_id is not null then
    select * into v_corte from public.cortes where solicitud_id = p_solicitud_id;
    if found then
      if v_corte.cliente_id <> p_cliente_id then
        raise exception using errcode = 'P0001', message = 'solicitud_invalida',
          hint = 'La clave de solicitud ya se usó para otro cliente.';
      end if;
      return v_corte;
    end if;
  end if;

  -- Anti doble registro (por ejemplo, escanear dos veces el mismo QR).
  if exists (
    select 1 from public.cortes
    where cliente_id = p_cliente_id
      and fecha > now() - interval '60 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'corte_reciente',
      hint = 'Ya se registró un corte a este cliente hace menos de un minuto.';
  end if;

  insert into public.cortes (cliente_id, registrado_por, solicitud_id, monto, medio_pago)
  values (
    p_cliente_id,
    (select auth.uid()),
    p_solicitud_id,
    round(p_monto, 2),
    -- Sin cobro (sin monto o $ 0) no hay medio de pago.
    case when round(p_monto, 2) > 0 then p_medio_pago end
  )
  returning * into v_corte;

  return v_corte;
end;
$$;

comment on function public.registrar_corte(uuid, uuid, numeric, text) is
  'Suma un corte a un cliente, con el monto cobrado y el medio de pago (opcionales). Solo barberos. Idempotente por solicitud.';

-- ─── registrar_servicio_hecho ───────────────────────────────────────────────
-- Permisos: los de la agenda (_exigir_agenda): el empleado carga los suyos; el
-- dueño, los de cualquier barbero que atiende (el admin no atiende).
create or replace function public.registrar_servicio_hecho(
  p_barbero uuid,
  p_monto numeric,
  p_medio_pago text,
  p_servicio uuid default null,
  p_nombre text default null,
  p_nota text default null,
  p_solicitud_id uuid default null
)
returns public.servicios_hechos
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hecho public.servicios_hechos;
  v_nombre text := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
  v_nota text := nullif(regexp_replace(btrim(coalesce(p_nota, '')), '\s+', ' ', 'g'), '');
  v_servicio public.servicios;
begin
  perform public._exigir_agenda(p_barbero);

  -- Idempotencia: un doble toque no carga dos veces.
  if p_solicitud_id is not null then
    select * into v_hecho from public.servicios_hechos where solicitud_id = p_solicitud_id;
    if found then
      if v_hecho.registrado_por is distinct from (select auth.uid()) then
        raise exception using errcode = 'P0001', message = 'solicitud_invalida',
          hint = 'La clave de solicitud ya se usó.';
      end if;
      return v_hecho;
    end if;
  end if;

  if p_monto is null or round(p_monto, 2) <= 0 or p_monto > 9999999 then
    raise exception using errcode = '22003', message = 'monto_invalido',
      hint = 'El monto tiene que ser mayor a 0 y hasta 9.999.999.';
  end if;
  if p_medio_pago is null then
    raise exception using errcode = '22023', message = 'medio_pago_invalido',
      hint = 'Falta el medio de pago.';
  end if;
  perform public._validar_medio_pago(p_medio_pago);

  if p_servicio is not null then
    select * into v_servicio from public.servicios
    where id = p_servicio and barbero_id = p_barbero;
    if not found then
      raise exception using errcode = 'P0002', message = 'servicio_inexistente',
        hint = 'Ese servicio no es de este barbero.';
    end if;
    if v_nombre = '' then
      v_nombre := v_servicio.nombre;
    end if;
  end if;

  if char_length(v_nombre) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'servicio_nombre_invalido',
      hint = 'El nombre tiene que tener entre 2 y 60 letras.';
  end if;
  if v_nota is not null and char_length(v_nota) > 80 then
    raise exception using errcode = '22023', message = 'nota_invalida',
      hint = 'La aclaración puede tener hasta 80 letras.';
  end if;

  insert into public.servicios_hechos (
    barbero_id, servicio_id, servicio_nombre, monto, medio_pago, nota, registrado_por, solicitud_id
  )
  values (
    p_barbero, p_servicio, v_nombre, round(p_monto, 2), p_medio_pago, v_nota,
    (select auth.uid()), p_solicitud_id
  )
  returning * into v_hecho;

  return v_hecho;
end;
$$;

comment on function public.registrar_servicio_hecho(uuid, numeric, text, uuid, text, text, uuid) is
  'Carga un servicio cobrado sin cliente registrado. El empleado, los suyos; el dueño, los de cualquiera. Idempotente por solicitud.';

-- ─── deshacer_servicio_hecho ────────────────────────────────────────────────
-- Mismas reglas que deshacer_corte: el empleado, los que cargó él dentro de los
-- 10 minutos; el dueño, cualquiera dentro de los 10 minutos o del mismo día.
create or replace function public.deshacer_servicio_hecho(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hecho public.servicios_hechos;
  v_dueno boolean;
begin
  perform public._exigir_barbero();
  v_dueno := public.es_dueno();

  select * into v_hecho from public.servicios_hechos where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'servicio_hecho_inexistente',
      hint = 'El servicio no existe o ya se deshizo.';
  end if;

  if not v_dueno and v_hecho.registrado_por is distinct from (select auth.uid()) then
    raise exception using errcode = '42501', message = 'servicio_hecho_ajeno',
      hint = 'El empleado solo puede deshacer los servicios que cargó él.';
  end if;

  if v_hecho.fecha < now() - interval '10 minutes' and not (
    v_dueno
    and (v_hecho.fecha at time zone 'America/Argentina/Buenos_Aires')::date
      = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  ) then
    raise exception using errcode = 'P0001', message = 'servicio_fuera_de_plazo',
      hint = 'El empleado deshace dentro de los 10 minutos; el dueño, en el mismo día.';
  end if;

  delete from public.servicios_hechos where id = p_id;
end;
$$;

comment on function public.deshacer_servicio_hecho(uuid) is
  'Borra un servicio sin cliente. El empleado: los suyos, dentro de los 10 minutos. El dueño: cualquiera, dentro de los 10 minutos o del mismo día.';

-- ─── facturacion: suma los servicios sin cliente y separa por medio de pago ─
-- Cambia el tipo de retorno (columnas nuevas al final): hay que recrearla.
--   · total: cortes + servicios sin cliente.
--   · efectivo / transferencia: lo cobrado por cada medio. Lo que falta para
--     llegar al total son cortes viejos, cargados sin medio de pago.
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
  transferencia numeric
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
    select co.registrado_por as barbero, true as es_corte, co.monto, co.medio_pago
    from public.cortes co
    where co.fecha >= v_desde and co.fecha < v_hasta
    union all
    select sh.barbero_id, false, sh.monto, sh.medio_pago
    from public.servicios_hechos sh
    where sh.fecha >= v_desde and sh.fecha < v_hasta
  ),
  por_barbero as (
    select
      b.id as barbero_id,
      b.nombre as barbero_nombre,
      b.es_dueno,
      (count(m.barbero) filter (where m.es_corte))::integer as cortes,
      (count(m.barbero) filter (where m.es_corte and m.monto is null))::integer as cortes_sin_monto,
      coalesce(sum(m.monto), 0)::numeric as total,
      b.es_admin,
      (count(m.barbero) filter (where not m.es_corte))::integer as servicios,
      coalesce(sum(m.monto) filter (where m.medio_pago = 'efectivo'), 0)::numeric as efectivo,
      coalesce(sum(m.monto) filter (where m.medio_pago = 'transferencia'), 0)::numeric as transferencia
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
      (count(*) filter (where m.es_corte))::integer as cortes,
      (count(*) filter (where m.es_corte and m.monto is null))::integer as cortes_sin_monto,
      coalesce(sum(m.monto), 0)::numeric as total,
      false as es_admin,
      (count(*) filter (where not m.es_corte))::integer as servicios,
      coalesce(sum(m.monto) filter (where m.medio_pago = 'efectivo'), 0)::numeric as efectivo,
      coalesce(sum(m.monto) filter (where m.medio_pago = 'transferencia'), 0)::numeric as transferencia
    from m
    where m.barbero is null
    having count(*) > 0
  )
  select x.barbero_id, x.barbero_nombre, x.es_dueno, x.cortes, x.cortes_sin_monto, x.total,
         x.es_admin, x.servicios, x.efectivo, x.transferencia
  from (
    select * from por_barbero
    union all
    select * from sin_barbero
  ) x
  order by x.barbero_id is null, x.es_admin, x.es_dueno desc, x.barbero_nombre;
end;
$$;

comment on function public.facturacion(date, date) is
  'Cortes, servicios sin cliente y total cobrado (en efectivo y por transferencia) por barbero entre dos fechas (inclusive, hora argentina). Solo el dueño.';

-- ─── movimientos_caja ───────────────────────────────────────────────────────
-- Todo lo cobrado en un período, del más nuevo al más viejo: cortes (con el
-- servicio del turno, si tenía) y servicios sin cliente. Para la lista de la
-- caja (paginada desde la API) y el informe del contador.
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
  ) x
  order by x.fecha desc, x.id;
end;
$$;

comment on function public.movimientos_caja(date, date) is
  'Cortes y servicios sin cliente de un período (inclusive, hora argentina), con barbero, servicio, monto y medio de pago. Solo el dueño.';

-- ─── RLS y permisos ─────────────────────────────────────────────────────────
alter table public.servicios_hechos enable row level security;

revoke all on table public.servicios_hechos from anon, authenticated;
-- Solo lectura (por RLS). Todo se escribe por funciones.
grant select on table public.servicios_hechos to authenticated;
grant all on table public.servicios_hechos to service_role;

drop policy if exists "servicios hechos: el dueño ve todos; el empleado, los suyos"
  on public.servicios_hechos;
create policy "servicios hechos: el dueño ve todos; el empleado, los suyos"
  on public.servicios_hechos
  for select
  to authenticated
  using (
    (select public.es_dueno())
    or (
      (barbero_id = (select auth.uid()) or registrado_por = (select auth.uid()))
      and (select public.es_barbero())
    )
  );

revoke execute on function
  public._validar_medio_pago(text),
  public.registrar_corte(uuid, uuid, numeric, text),
  public.registrar_servicio_hecho(uuid, numeric, text, uuid, text, text, uuid),
  public.deshacer_servicio_hecho(uuid),
  public.facturacion(date, date),
  public.movimientos_caja(date, date)
from public, anon, authenticated;

-- Cada función vuelve a verificar quién llama.
grant execute on function
  public.registrar_corte(uuid, uuid, numeric, text),
  public.registrar_servicio_hecho(uuid, numeric, text, uuid, text, text, uuid),
  public.deshacer_servicio_hecho(uuid),
  public.facturacion(date, date),
  public.movimientos_caja(date, date)
to authenticated;
