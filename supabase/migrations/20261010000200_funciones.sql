-- ════════════════════════════════════════════════════════════════════════════
-- Funciones, vista de resumen y operaciones atómicas.
--
-- Convención de errores: las funciones lanzan excepciones cuyo MESSAGE es un
-- código estable en snake_case (ej.: 'sin_premios'). La app lo traduce a un
-- mensaje amigable. El HINT trae una explicación en castellano para debug.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── es_barbero() ───────────────────────────────────────────────────────────
-- security definer: lee perfiles salteando RLS (evita recursión en las policies).
-- search_path vacío: todos los objetos van calificados con su schema.
create or replace function public.es_barbero()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = (select auth.uid())
      and rol = 'barbero'
  );
$$;

comment on function public.es_barbero() is 'true si el usuario autenticado tiene rol barbero.';

-- ─── Vista resumen_clientes ─────────────────────────────────────────────────
-- security_invoker: respeta el RLS de quien consulta (el cliente solo ve su fila).
create or replace view public.resumen_clientes
with (security_invoker = true)
as
with regla as (
  select r.cortes_necesarios, r.descripcion_premio
  from public.reglas r
  where r.activa
  limit 1
)
select
  p.id,
  p.nombre,
  p.telefono,
  p.created_at,
  p.debe_cambiar_password,
  p.busqueda,
  coalesce(c.total, 0)::integer as total_cortes,
  c.ultimo as ultimo_corte,
  coalesce(k.total, 0)::integer as total_canjes,
  r.cortes_necesarios,
  r.descripcion_premio,
  case
    when r.cortes_necesarios is null then 0
    else (coalesce(c.total, 0) % r.cortes_necesarios)::integer
  end as sellos_actuales,
  case
    when r.cortes_necesarios is null then 0
    else greatest(0, coalesce(c.total, 0) / r.cortes_necesarios - coalesce(k.total, 0))::integer
  end as premios_disponibles
from public.perfiles p
left join lateral (
  select count(*) as total, max(co.fecha) as ultimo
  from public.cortes co
  where co.cliente_id = p.id
) c on true
left join lateral (
  select count(*) as total
  from public.canjes ca
  where ca.cliente_id = p.id
) k on true
left join regla r on true
where p.rol = 'cliente';

comment on view public.resumen_clientes is
  'Por cliente: total de cortes, sellos actuales (cortes % N) y premios disponibles (floor(cortes / N) - canjes).';

-- ─── Helpers internos ───────────────────────────────────────────────────────
create or replace function public._exigir_barbero()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_barbero() then
    raise exception using errcode = '42501', message = 'no_autorizado',
      hint = 'Solo el barbero puede hacer esta operación.';
  end if;
end;
$$;

-- Bloquea la fila del cliente durante la transacción. Serializa todas las
-- operaciones sobre un mismo cliente (sumar, deshacer, canjear).
create or replace function public._bloquear_cliente(p_cliente_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.perfiles
  where id = p_cliente_id
    and rol = 'cliente'
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'cliente_inexistente',
      hint = 'El cliente no existe.';
  end if;
end;
$$;

-- ─── registrar_corte ────────────────────────────────────────────────────────
create or replace function public.registrar_corte(
  p_cliente_id uuid,
  p_solicitud_id uuid default null
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

  insert into public.cortes (cliente_id, registrado_por, solicitud_id)
  values (p_cliente_id, (select auth.uid()), p_solicitud_id)
  returning * into v_corte;

  return v_corte;
end;
$$;

comment on function public.registrar_corte(uuid, uuid) is 'Suma un corte a un cliente. Solo barbero. Idempotente por solicitud.';

-- ─── deshacer_corte ─────────────────────────────────────────────────────────
create or replace function public.deshacer_corte(p_corte_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_corte public.cortes;
  v_total integer;
  v_canjes integer;
  v_n integer;
begin
  perform public._exigir_barbero();

  select * into v_corte from public.cortes where id = p_corte_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'corte_inexistente',
      hint = 'El corte no existe o ya se deshizo.';
  end if;

  perform public._bloquear_cliente(v_corte.cliente_id);

  -- Releemos con el cliente bloqueado (otra transacción pudo borrarlo).
  perform 1 from public.cortes where id = p_corte_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'corte_inexistente',
      hint = 'El corte no existe o ya se deshizo.';
  end if;

  if v_corte.fecha < now() - interval '10 minutes' then
    raise exception using errcode = 'P0001', message = 'fuera_de_plazo',
      hint = 'Solo se puede deshacer un corte dentro de los 10 minutos de cargado.';
  end if;

  select count(*) into v_total from public.cortes where cliente_id = v_corte.cliente_id;
  select count(*) into v_canjes from public.canjes where cliente_id = v_corte.cliente_id;
  select cortes_necesarios into v_n from public.reglas where activa limit 1;

  -- Si este corte completó un premio que ya se canjeó, no se puede deshacer.
  if v_n is not null and (v_total - 1) / v_n < v_canjes then
    raise exception using errcode = 'P0001', message = 'premio_ya_canjeado',
      hint = 'Este corte completó un premio que ya fue canjeado.';
  end if;

  delete from public.cortes where id = p_corte_id;
end;
$$;

comment on function public.deshacer_corte(uuid) is 'Borra un corte cargado hace menos de 10 minutos. Solo barbero.';

-- ─── canjear_premio ─────────────────────────────────────────────────────────
create or replace function public.canjear_premio(
  p_cliente_id uuid,
  p_solicitud_id uuid default null
)
returns public.canjes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_canje public.canjes;
  v_regla public.reglas;
  v_total integer;
  v_canjes integer;
begin
  perform public._exigir_barbero();
  -- El bloqueo hace que dos canjes simultáneos se ejecuten uno detrás del otro:
  -- el segundo ve el canje del primero y recalcula los disponibles.
  perform public._bloquear_cliente(p_cliente_id);

  if p_solicitud_id is not null then
    select * into v_canje from public.canjes where solicitud_id = p_solicitud_id;
    if found then
      if v_canje.cliente_id <> p_cliente_id then
        raise exception using errcode = 'P0001', message = 'solicitud_invalida',
          hint = 'La clave de solicitud ya se usó para otro cliente.';
      end if;
      return v_canje;
    end if;
  end if;

  select * into v_regla from public.reglas where activa limit 1;
  if not found then
    raise exception using errcode = 'P0001', message = 'sin_regla',
      hint = 'No hay una regla de premios activa.';
  end if;

  select count(*) into v_total from public.cortes where cliente_id = p_cliente_id;
  select count(*) into v_canjes from public.canjes where cliente_id = p_cliente_id;

  if v_total / v_regla.cortes_necesarios - v_canjes < 1 then
    raise exception using errcode = 'P0001', message = 'sin_premios',
      hint = 'El cliente no tiene premios disponibles.';
  end if;

  insert into public.canjes (cliente_id, registrado_por, premio_descripcion, solicitud_id)
  values (p_cliente_id, (select auth.uid()), v_regla.descripcion_premio, p_solicitud_id)
  returning * into v_canje;

  return v_canje;
end;
$$;

comment on function public.canjear_premio(uuid, uuid) is 'Canjea un premio de forma atómica. Solo barbero. Idempotente por solicitud.';

-- ─── guardar_regla ──────────────────────────────────────────────────────────
create or replace function public.guardar_regla(
  p_cortes_necesarios integer,
  p_descripcion_premio text
)
returns public.reglas
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actual public.reglas;
  v_nueva public.reglas;
  v_descripcion text := btrim(p_descripcion_premio);
begin
  perform public._exigir_barbero();

  -- Serializa los cambios de regla.
  lock table public.reglas in share row exclusive mode;

  select * into v_actual from public.reglas where activa limit 1;
  if found
    and v_actual.cortes_necesarios = p_cortes_necesarios
    and v_actual.descripcion_premio = v_descripcion then
    return v_actual;
  end if;

  update public.reglas set activa = false where activa;

  insert into public.reglas (cortes_necesarios, descripcion_premio, activa)
  values (p_cortes_necesarios, v_descripcion, true)
  returning * into v_nueva;

  return v_nueva;
end;
$$;

comment on function public.guardar_regla(integer, text) is 'Reemplaza la regla activa (la anterior queda en el historial). Solo barbero.';

-- ─── metricas_panel ─────────────────────────────────────────────────────────
create or replace function public.metricas_panel()
returns table (
  clientes_total integer,
  clientes_nuevos_mes integer,
  cortes_mes integer,
  cortes_mes_anterior integer,
  canjes_mes integer,
  canjes_total integer,
  premios_pendientes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inicio_mes timestamptz :=
    date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')
      at time zone 'America/Argentina/Buenos_Aires';
  v_inicio_mes_anterior timestamptz :=
    (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') - interval '1 month')
      at time zone 'America/Argentina/Buenos_Aires';
begin
  perform public._exigir_barbero();

  return query
  select
    (select count(*) from public.perfiles where rol = 'cliente')::integer,
    (select count(*) from public.perfiles where rol = 'cliente' and created_at >= v_inicio_mes)::integer,
    (select count(*) from public.cortes where fecha >= v_inicio_mes)::integer,
    (select count(*) from public.cortes where fecha >= v_inicio_mes_anterior and fecha < v_inicio_mes)::integer,
    (select count(*) from public.canjes where fecha >= v_inicio_mes)::integer,
    (select count(*) from public.canjes)::integer,
    (select coalesce(sum(premios_disponibles), 0) from public.resumen_clientes)::integer;
end;
$$;

comment on function public.metricas_panel() is 'Métricas del dashboard del barbero (mes calendario en hora argentina).';

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- El carnet del cliente escucha sus cortes y canjes para actualizarse en vivo.
-- Realtime respeta el RLS: cada cliente solo recibe sus propios registros.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.cortes, public.canjes;
  end if;
end;
$$;
