-- ════════════════════════════════════════════════════════════════════════════
-- Dos barberos (dueño y empleado), precio habitual por cliente y monto de
-- cada corte.
--
-- Pensada para aplicarse sobre una base EN USO, sin perder ni romper datos:
--   · Las columnas nuevas aceptan null: los cortes viejos quedan "sin monto"
--     y los clientes, "sin precio".
--   · El/los barbero(s) que ya existen pasan a ser DUEÑO (es_dueno = true).
--   · Los cortes viejos conservan su registrado_por (siempre lo guardó
--     registrar_corte, y hasta hoy había un solo barbero: el dueño).
--   · registrar_corte suma un parámetro opcional (p_monto): la versión anterior
--     de la app lo sigue llamando igual mientras se publica la nueva.
--
-- Permisos:
--   · dueño:    todo lo que hacía el barbero + ve todos los cortes y montos,
--               totales por barbero, edita precios, la regla y los descuentos.
--   · empleado: busca, da de alta, suma cortes (con monto), deshace SUS cortes
--               y canjea premios. Solo ve los cortes que cargó él.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── perfiles: dueño y precio habitual ──────────────────────────────────────
alter table public.perfiles
  add column if not exists es_dueno boolean not null default false,
  add column if not exists precio_habitual numeric(12, 2);

alter table public.perfiles
  add constraint perfiles_dueno_es_barbero check (not es_dueno or rol = 'barbero'),
  add constraint perfiles_precio_valido
    check (precio_habitual is null or (precio_habitual >= 0 and precio_habitual <= 9999999));

comment on column public.perfiles.es_dueno is
  'Solo barberos. true = dueño (ve montos y totales, configura). false = empleado.';
comment on column public.perfiles.precio_habitual is
  'Lo que suele pagar el cliente por un corte. Se precarga al registrar un corte. Null = sin precio.';

-- El barbero que ya existe es el dueño.
update public.perfiles set es_dueno = true where rol = 'barbero' and not es_dueno;

-- ─── cortes: monto pagado ───────────────────────────────────────────────────
alter table public.cortes add column if not exists monto numeric(12, 2);

alter table public.cortes
  add constraint cortes_monto_valido check (monto is null or (monto >= 0 and monto <= 9999999));

comment on column public.cortes.monto is
  'Lo que pagó el cliente por este corte. Null en los cortes anteriores a esta función (sin monto).';
comment on column public.cortes.registrado_por is
  'Barbero que cargó el corte. Null si el barbero fue eliminado.';

-- Historial y totales por barbero (reemplaza al índice simple de registrado_por).
create index if not exists cortes_registrado_fecha_idx on public.cortes (registrado_por, fecha desc);
drop index if exists public.cortes_registrado_por_idx;

-- ─── es_dueno() / _exigir_dueno() ───────────────────────────────────────────
create or replace function public.es_dueno()
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
      and es_dueno
  );
$$;

comment on function public.es_dueno() is 'true si el usuario autenticado es el barbero dueño.';

create or replace function public._exigir_dueno()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_dueno() then
    raise exception using errcode = '42501', message = 'no_autorizado',
      hint = 'Solo el dueño puede hacer esta operación.';
  end if;
end;
$$;

-- ─── Totales por cliente (para la vista resumen_clientes) ───────────────────
-- El empleado solo puede LEER los cortes que cargó él (RLS), pero la tarjeta de
-- sellos tiene que contar todos. Esta función cuenta salteando el RLS y solo
-- devuelve números (nunca montos ni quién hizo cada corte). Responde únicamente
-- si quien pregunta es barbero, el propio cliente o el servidor.
create or replace function public._totales_cliente(p_cliente_id uuid)
returns table (total_cortes integer, ultimo_corte timestamptz, total_canjes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.cortes co where co.cliente_id = p_cliente_id),
    (select max(co.fecha) from public.cortes co where co.cliente_id = p_cliente_id),
    (select count(*)::integer from public.canjes ca where ca.cliente_id = p_cliente_id)
  where p_cliente_id = (select auth.uid())
     or public.es_barbero()
     -- Servidor (service_role) o SQL Editor: sin restricción.
     or coalesce(
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''
        ) not in ('anon', 'authenticated');
$$;

comment on function public._totales_cliente(uuid) is
  'Cantidad de cortes, último corte y cantidad de canjes de un cliente. Solo barberos o el propio cliente.';

-- Misma vista, mismas columnas y en el mismo orden (+ precio_habitual al final).
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
  coalesce(t.total_cortes, 0)::integer as total_cortes,
  t.ultimo_corte,
  coalesce(t.total_canjes, 0)::integer as total_canjes,
  r.cortes_necesarios,
  r.descripcion_premio,
  case
    when r.cortes_necesarios is null then 0
    else (coalesce(t.total_cortes, 0) % r.cortes_necesarios)::integer
  end as sellos_actuales,
  case
    when r.cortes_necesarios is null then 0
    else greatest(0, coalesce(t.total_cortes, 0) / r.cortes_necesarios - coalesce(t.total_canjes, 0))::integer
  end as premios_disponibles,
  p.precio_habitual
from public.perfiles p
left join lateral public._totales_cliente(p.id) t on true
left join regla r on true
where p.rol = 'cliente';

comment on view public.resumen_clientes is
  'Por cliente: total de cortes, sellos actuales (cortes % N), premios disponibles (floor(cortes / N) - canjes) y precio habitual.';

-- ─── registrar_corte (ahora con monto) ──────────────────────────────────────
-- Se reemplaza la versión de 2 parámetros: si convivieran, la API no sabría
-- cuál llamar. Con p_monto opcional, las llamadas viejas siguen funcionando.
drop function if exists public.registrar_corte(uuid, uuid);

create function public.registrar_corte(
  p_cliente_id uuid,
  p_solicitud_id uuid default null,
  p_monto numeric default null
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

  insert into public.cortes (cliente_id, registrado_por, solicitud_id, monto)
  values (p_cliente_id, (select auth.uid()), p_solicitud_id, round(p_monto, 2))
  returning * into v_corte;

  return v_corte;
end;
$$;

comment on function public.registrar_corte(uuid, uuid, numeric) is
  'Suma un corte a un cliente, con el monto cobrado (opcional). Solo barberos. Idempotente por solicitud.';

-- ─── deshacer_corte: el empleado solo deshace los suyos ─────────────────────
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

  if not public.es_dueno() and v_corte.registrado_por is distinct from (select auth.uid()) then
    raise exception using errcode = '42501', message = 'corte_ajeno',
      hint = 'El empleado solo puede deshacer los cortes que cargó él.';
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

comment on function public.deshacer_corte(uuid) is
  'Borra un corte cargado hace menos de 10 minutos. El dueño, cualquiera; el empleado, solo los suyos.';

-- ─── guardar_regla: solo el dueño ───────────────────────────────────────────
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
  perform public._exigir_dueno();

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

comment on function public.guardar_regla(integer, text) is
  'Reemplaza la regla activa (la anterior queda en el historial). Solo el dueño.';

-- ─── guardar_precio_cliente: solo el dueño ──────────────────────────────────
create or replace function public.guardar_precio_cliente(
  p_cliente_id uuid,
  p_precio numeric
)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_precio numeric(12, 2) := round(p_precio, 2);
begin
  perform public._exigir_dueno();

  if v_precio is not null and (v_precio < 0 or v_precio > 9999999) then
    raise exception using errcode = '22003', message = 'monto_invalido',
      hint = 'El precio tiene que estar entre 0 y 9.999.999.';
  end if;

  update public.perfiles
  set precio_habitual = v_precio
  where id = p_cliente_id
    and rol = 'cliente';

  if not found then
    raise exception using errcode = 'P0002', message = 'cliente_inexistente',
      hint = 'El cliente no existe.';
  end if;

  return v_precio;
end;
$$;

comment on function public.guardar_precio_cliente(uuid, numeric) is
  'Cambia el precio habitual de un cliente (null = sin precio). Solo el dueño.';

-- ─── facturacion: totales por barbero en un período ─────────────────────────
-- Fechas inclusive, en hora argentina. Una fila por barbero (aunque no tenga
-- cortes) y, si hay, una fila con barbero_id null para los cortes sin barbero.
create or replace function public.facturacion(p_desde date, p_hasta date)
returns table (
  barbero_id uuid,
  barbero_nombre text,
  es_dueno boolean,
  cortes integer,
  cortes_sin_monto integer,
  total numeric
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
  with c as (
    select co.registrado_por, co.monto
    from public.cortes co
    where co.fecha >= v_desde
      and co.fecha < v_hasta
  ),
  por_barbero as (
    select
      b.id as barbero_id,
      b.nombre as barbero_nombre,
      b.es_dueno,
      count(c.registrado_por)::integer as cortes,
      (count(c.registrado_por) filter (where c.monto is null))::integer as cortes_sin_monto,
      coalesce(sum(c.monto), 0)::numeric as total
    from public.perfiles b
    left join c on c.registrado_por = b.id
    where b.rol = 'barbero'
    group by b.id, b.nombre, b.es_dueno
  ),
  sin_barbero as (
    select
      null::uuid as barbero_id,
      null::text as barbero_nombre,
      false as es_dueno,
      count(*)::integer as cortes,
      (count(*) filter (where c.monto is null))::integer as cortes_sin_monto,
      coalesce(sum(c.monto), 0)::numeric as total
    from c
    where c.registrado_por is null
    having count(*) > 0
  )
  select x.barbero_id, x.barbero_nombre, x.es_dueno, x.cortes, x.cortes_sin_monto, x.total
  from (
    select * from por_barbero
    union all
    select * from sin_barbero
  ) x
  order by x.barbero_id is null, x.es_dueno desc, x.barbero_nombre;
end;
$$;

comment on function public.facturacion(date, date) is
  'Cortes y total cobrado por barbero entre dos fechas (inclusive, hora argentina). Solo el dueño.';

-- ─── metricas_panel: el empleado ve solo sus cortes del mes ─────────────────
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
  v_uid uuid := (select auth.uid());
  v_dueno boolean := public.es_dueno();
begin
  perform public._exigir_barbero();

  return query
  select
    (select count(*) from public.perfiles where rol = 'cliente')::integer,
    (select count(*) from public.perfiles where rol = 'cliente' and created_at >= v_inicio_mes)::integer,
    (select count(*) from public.cortes
      where fecha >= v_inicio_mes and (v_dueno or registrado_por = v_uid))::integer,
    (select count(*) from public.cortes
      where fecha >= v_inicio_mes_anterior and fecha < v_inicio_mes
        and (v_dueno or registrado_por = v_uid))::integer,
    (select count(*) from public.canjes where fecha >= v_inicio_mes)::integer,
    (select count(*) from public.canjes)::integer,
    (select coalesce(sum(premios_disponibles), 0) from public.resumen_clientes)::integer;
end;
$$;

comment on function public.metricas_panel() is
  'Métricas del dashboard (mes calendario en hora argentina). Para el empleado, los cortes son solo los suyos.';

-- ─── Permisos de funciones ──────────────────────────────────────────────────
revoke execute on function
  public.es_dueno(),
  public._exigir_dueno(),
  public._totales_cliente(uuid),
  public.registrar_corte(uuid, uuid, numeric),
  public.guardar_precio_cliente(uuid, numeric),
  public.facturacion(date, date)
from public, anon, authenticated;

-- es_dueno() se evalúa en las policies; _totales_cliente() desde la vista
-- (security_invoker), y vuelve a chequear quién pregunta.
grant execute on function
  public.es_dueno(),
  public._totales_cliente(uuid),
  public.registrar_corte(uuid, uuid, numeric),
  public.guardar_precio_cliente(uuid, numeric),
  public.facturacion(date, date)
to authenticated;

-- ─── Policies: cortes ───────────────────────────────────────────────────────
drop policy if exists "cortes: el cliente ve los suyos; el barbero ve todos" on public.cortes;

create policy "cortes: el cliente ve los suyos; el dueño, todos; el empleado, los que cargó"
  on public.cortes
  for select
  to authenticated
  using (
    cliente_id = (select auth.uid())
    or (select public.es_dueno())
    or (registrado_por = (select auth.uid()) and (select public.es_barbero()))
  );

-- ─── Policies: descuentos (escritura solo del dueño) ────────────────────────
drop policy if exists "descuentos: el barbero crea" on public.descuentos_asociados;
drop policy if exists "descuentos: el barbero edita" on public.descuentos_asociados;
drop policy if exists "descuentos: el barbero borra" on public.descuentos_asociados;

create policy "descuentos: el dueño crea"
  on public.descuentos_asociados
  for insert
  to authenticated
  with check ((select public.es_dueno()));

create policy "descuentos: el dueño edita"
  on public.descuentos_asociados
  for update
  to authenticated
  using ((select public.es_dueno()))
  with check ((select public.es_dueno()));

create policy "descuentos: el dueño borra"
  on public.descuentos_asociados
  for delete
  to authenticated
  using ((select public.es_dueno()));
