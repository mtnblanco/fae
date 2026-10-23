-- ════════════════════════════════════════════════════════════════════════════
-- Premios por etapas: la regla define una tarjeta de L cortes con 1 a 6 etapas
-- ("al 4.º corte 20% off, al 7.º 50% off, al 10.º corte gratis"). Al llegar a
-- la última etapa (L), la tarjeta se completa y vuelve a empezar.
--
-- Pensada para aplicarse sobre una base EN USO, sin cambiar lo que ve ni lo que
-- tiene disponible ningún cliente:
--   · La regla vigente ("cada N cortes, un premio") pasa a ser una regla de UNA
--     etapa en el corte N. Con una sola etapa, las cuentas dan exactamente lo
--     mismo que antes: sellos = cortes % N y disponibles = floor(cortes / N) − canjes.
--   · Las columnas de antes siguen existiendo y con el mismo significado para
--     la versión anterior de la app: reglas.cortes_necesarios (= L, el largo de
--     la tarjeta) y reglas.descripcion_premio (= premio de la última etapa), y la
--     vista resumen_clientes mantiene todas sus columnas en el mismo orden.
--   · canjear_premio y guardar_regla aceptan las mismas llamadas que antes:
--     canjear sin decir la etapa canjea el primer premio disponible, y guardar
--     una regla "cada N cortes" crea una regla de una etapa.
--
-- Cómo se cuentan los premios (ver _repartir_premios):
--   · Etapa en el corte s, tarjeta de L cortes, T cortes en total:
--       ganados(s) = floor(T / L) + (1 si T % L >= s)
--     Los premios ganados no vencen al reiniciar la tarjeta.
--   · Cada canje guarda la etapa (número de corte) y la descripción vigente.
--     disponibles(s) = ganados(s) − canjes de esa etapa.
--   · Canjes que no corresponden a ninguna etapa de la regla actual (canjes
--     viejos, o de una etapa que ya no existe después de un cambio de regla) y
--     los que superan lo ganado en su etapa se descuentan de las demás etapas,
--     empezando por la de menor número de corte. Así nunca hay disponibles
--     negativos y el total siempre es max(0, ganados − canjes), como antes.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Validación de etapas ───────────────────────────────────────────────────
-- Un array de 1 a 6 objetos {"corte": entero 1–30, "descripcion": texto de 3 a
-- 120 caracteres}, con cortes estrictamente crecientes (distintos y ordenados).
create or replace function public._etapas_validas(p_etapas jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_etapa jsonb;
  v_corte integer;
  v_anterior integer := 0;
begin
  if p_etapas is null or jsonb_typeof(p_etapas) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(p_etapas) not between 1 and 6 then
    return false;
  end if;

  for v_etapa in select e from jsonb_array_elements(p_etapas) as x(e) loop
    if jsonb_typeof(v_etapa) <> 'object'
      or jsonb_typeof(v_etapa -> 'corte') <> 'number'
      or jsonb_typeof(v_etapa -> 'descripcion') <> 'string'
      or (v_etapa ->> 'corte') !~ '^[0-9]{1,2}$' then
      return false;
    end if;
    v_corte := (v_etapa ->> 'corte')::integer;
    if v_corte not between 1 and 30 or v_corte <= v_anterior then
      return false;
    end if;
    if char_length(btrim(v_etapa ->> 'descripcion')) not between 3 and 120 then
      return false;
    end if;
    v_anterior := v_corte;
  end loop;

  return true;
end;
$$;

comment on function public._etapas_validas(jsonb) is
  'true si las etapas son 1 a 6 {corte 1–30, descripcion 3–120}, con cortes crecientes.';

-- ─── reglas: etapas ─────────────────────────────────────────────────────────
alter table public.reglas add column if not exists etapas jsonb;

comment on column public.reglas.etapas is
  'Etapas de la tarjeta, ordenadas: [{"corte": 4, "descripcion": "20% off"}, …]. La última define el largo (cortes_necesarios) y su premio (descripcion_premio).';
comment on column public.reglas.cortes_necesarios is
  'Largo de la tarjeta: el corte de la última etapa. Se calcula solo a partir de etapas.';
comment on column public.reglas.descripcion_premio is
  'Premio de la última etapa. Se calcula solo a partir de etapas.';

-- Todas las reglas existentes (la activa y el historial) pasan a ser de una etapa.
update public.reglas
set etapas = jsonb_build_array(
  jsonb_build_object('corte', cortes_necesarios, 'descripcion', descripcion_premio)
)
where etapas is null;

-- Mantiene sincronizadas las columnas de antes con las etapas. Si alguien
-- inserta una regla "a la vieja" (sin etapas), se arma una de una etapa.
create or replace function public._sincronizar_regla()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.etapas is null then
      new.etapas := jsonb_build_array(
        jsonb_build_object('corte', new.cortes_necesarios, 'descripcion', new.descripcion_premio)
      );
    end if;
  elsif new.etapas is not distinct from old.etapas
    and (new.cortes_necesarios is distinct from old.cortes_necesarios
      or new.descripcion_premio is distinct from old.descripcion_premio) then
    new.etapas := jsonb_build_array(
      jsonb_build_object('corte', new.cortes_necesarios, 'descripcion', new.descripcion_premio)
    );
  end if;

  if jsonb_typeof(new.etapas) = 'array' and jsonb_array_length(new.etapas) > 0 then
    new.cortes_necesarios := (new.etapas -> -1 ->> 'corte')::integer;
    new.descripcion_premio := new.etapas -> -1 ->> 'descripcion';
  end if;
  return new;
end;
$$;

drop trigger if exists reglas_sincronizar on public.reglas;
create trigger reglas_sincronizar
  before insert or update on public.reglas
  for each row execute function public._sincronizar_regla();

alter table public.reglas alter column etapas set not null;

-- La tarjeta puede tener hasta 30 cortes (antes, hasta 20).
alter table public.reglas drop constraint if exists reglas_cortes_rango;
alter table public.reglas
  add constraint reglas_cortes_rango check (cortes_necesarios between 1 and 30),
  add constraint reglas_etapas_validas check (public._etapas_validas(etapas)),
  add constraint reglas_etapas_consistentes check (
    cortes_necesarios = (etapas -> -1 ->> 'corte')::integer
    and descripcion_premio = etapas -> -1 ->> 'descripcion'
  );

-- ─── canjes: etapa canjeada ─────────────────────────────────────────────────
alter table public.canjes add column if not exists etapa integer;

alter table public.canjes
  add constraint canjes_etapa_rango check (etapa is null or etapa between 1 and 30);

comment on column public.canjes.etapa is
  'Número de corte de la etapa canjeada (según la regla vigente al canjear). Los canjes anteriores a las etapas guardan el N de la regla de ese momento.';

-- Canjes de antes: eran del premio de la única etapa (el corte N de la regla
-- vigente en ese momento). Con la regla de una etapa da lo mismo que dejarlos
-- sin etapa; se completa para que, si el dueño mantiene esa etapa, coincidan.
update public.canjes ca
set etapa = coalesce(
  (
    select r.cortes_necesarios
    from public.reglas r
    where r.created_at <= ca.fecha
    order by r.created_at desc
    limit 1
  ),
  (select r.cortes_necesarios from public.reglas r where r.activa limit 1)
)
where ca.etapa is null;

-- ─── _repartir_premios: premios ganados y disponibles por etapa ─────────────
-- Función pura (sin leer tablas): recibe la cantidad de cortes, las etapas de
-- la regla y la etapa de cada canje (null = sin etapa). Devuelve, por etapa:
-- [{corte, descripcion, ganados, canjeados, disponibles}].
create or replace function public._repartir_premios(
  p_total integer,
  p_etapas jsonb,
  p_canjes integer[]
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_n integer;
  v_cortes integer[];
  v_desc text[];
  v_ganados integer[] := '{}';
  v_canjeados integer[] := '{}';
  v_disp integer[] := '{}';
  v_total integer := greatest(coalesce(p_total, 0), 0);
  v_largo integer;
  v_ciclos integer;
  v_resto integer;
  v_exceso integer := 0;
  v_tomar integer;
  v_resultado jsonb := '[]'::jsonb;
begin
  if p_etapas is null or jsonb_typeof(p_etapas) <> 'array' or jsonb_array_length(p_etapas) = 0 then
    return '[]'::jsonb;
  end if;

  select
    array_agg((e ->> 'corte')::integer order by o),
    array_agg(e ->> 'descripcion' order by o)
  into v_cortes, v_desc
  from jsonb_array_elements(p_etapas) with ordinality as x(e, o);

  v_n := array_length(v_cortes, 1);
  v_largo := v_cortes[v_n];
  v_ciclos := v_total / v_largo;
  v_resto := v_total % v_largo;

  for i in 1 .. v_n loop
    v_ganados[i] := v_ciclos + case when v_resto >= v_cortes[i] then 1 else 0 end;
    v_canjeados[i] := (
      select count(*)::integer from unnest(coalesce(p_canjes, '{}')) c where c = v_cortes[i]
    );
    v_disp[i] := v_ganados[i] - v_canjeados[i];
    if v_disp[i] < 0 then
      -- Más canjes que premios ganados en esta etapa (por un cambio de regla).
      v_exceso := v_exceso - v_disp[i];
      v_disp[i] := 0;
    end if;
  end loop;

  -- Canjes sin etapa o de etapas que la regla actual no tiene.
  v_exceso := v_exceso + (
    select count(*)::integer
    from unnest(coalesce(p_canjes, '{}')) c
    where c is null or not (c = any (v_cortes))
  );

  -- Se descuentan de las etapas, empezando por la de menor número de corte.
  for i in 1 .. v_n loop
    exit when v_exceso = 0;
    v_tomar := least(v_disp[i], v_exceso);
    v_disp[i] := v_disp[i] - v_tomar;
    v_exceso := v_exceso - v_tomar;
  end loop;

  for i in 1 .. v_n loop
    v_resultado := v_resultado || jsonb_build_array(jsonb_build_object(
      'corte', v_cortes[i],
      'descripcion', v_desc[i],
      'ganados', v_ganados[i],
      'canjeados', v_canjeados[i],
      'disponibles', v_disp[i]
    ));
  end loop;

  return v_resultado;
end;
$$;

comment on function public._repartir_premios(integer, jsonb, integer[]) is
  'Premios ganados y disponibles por etapa, dados los cortes, las etapas y la etapa de cada canje.';

-- ─── Vista resumen_clientes ─────────────────────────────────────────────────
-- Mismas columnas y en el mismo orden (la app anterior sigue funcionando), más
-- `etapas` (de la regla activa) y `premios` (disponibles por etapa) al final.
--   · cortes_necesarios: largo de la tarjeta (L).
--   · descripcion_premio: premio de la última etapa.
--   · sellos_actuales: cortes % L.
--   · premios_disponibles: suma de los disponibles de todas las etapas.
create or replace view public.resumen_clientes
with (security_invoker = true)
as
with regla as (
  select r.cortes_necesarios, r.descripcion_premio, r.etapas
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
  coalesce((
    select sum((x ->> 'disponibles')::integer)
    from jsonb_array_elements(pr.premios) x
  ), 0)::integer as premios_disponibles,
  p.precio_habitual,
  r.etapas,
  coalesce(pr.premios, '[]'::jsonb) as premios
from public.perfiles p
left join lateral public._totales_cliente(p.id) t on true
left join regla r on true
left join lateral (
  select public._repartir_premios(
    t.total_cortes,
    r.etapas,
    (select array_agg(ca.etapa) from public.canjes ca where ca.cliente_id = p.id)
  ) as premios
  where t.total_cortes is not null
) pr on true
where p.rol = 'cliente';

comment on view public.resumen_clientes is
  'Por cliente: total de cortes, sellos actuales (cortes % L), premios disponibles por etapa y en total, y precio habitual.';

-- Premios de un cliente según la regla activa (para las funciones de abajo).
-- Llamar con la fila del cliente bloqueada.
create or replace function public._premios_cliente(p_cliente_id uuid, p_total integer default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public._repartir_premios(
    coalesce(p_total, (select count(*)::integer from public.cortes where cliente_id = p_cliente_id)),
    (select etapas from public.reglas where activa limit 1),
    (select array_agg(etapa) from public.canjes where cliente_id = p_cliente_id)
  );
$$;

-- ─── canjear_premio: el barbero elige qué premio ────────────────────────────
-- Se reemplaza la versión de 2 parámetros (si convivieran, la API no sabría
-- cuál llamar). Sin p_etapa, canjea el primer premio disponible (el de menor
-- número de corte): así la versión anterior de la app sigue funcionando.
drop function if exists public.canjear_premio(uuid, uuid);

create function public.canjear_premio(
  p_cliente_id uuid,
  p_solicitud_id uuid default null,
  p_etapa integer default null
)
returns public.canjes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_canje public.canjes;
  v_premios jsonb;
  v_premio jsonb;
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

  if not exists (select 1 from public.reglas where activa) then
    raise exception using errcode = 'P0001', message = 'sin_regla',
      hint = 'No hay una regla de premios activa.';
  end if;

  v_premios := public._premios_cliente(p_cliente_id);

  if p_etapa is null then
    select e into v_premio
    from jsonb_array_elements(v_premios) with ordinality as x(e, o)
    where (e ->> 'disponibles')::integer > 0
    order by o
    limit 1;
  else
    select e into v_premio
    from jsonb_array_elements(v_premios) as x(e)
    where (e ->> 'corte')::integer = p_etapa;
    if v_premio is null then
      raise exception using errcode = 'P0001', message = 'etapa_inexistente',
        hint = 'La regla de premios no tiene esa etapa (puede que la hayan cambiado).';
    end if;
  end if;

  if v_premio is null or (v_premio ->> 'disponibles')::integer < 1 then
    raise exception using errcode = 'P0001', message = 'sin_premios',
      hint = 'El cliente no tiene ese premio disponible.';
  end if;

  insert into public.canjes (cliente_id, registrado_por, premio_descripcion, solicitud_id, etapa)
  values (
    p_cliente_id,
    (select auth.uid()),
    v_premio ->> 'descripcion',
    p_solicitud_id,
    (v_premio ->> 'corte')::integer
  )
  returning * into v_canje;

  return v_canje;
end;
$$;

comment on function public.canjear_premio(uuid, uuid, integer) is
  'Canjea un premio disponible (de la etapa indicada o, si no, el primero). Atómico, solo barberos, idempotente por solicitud.';

-- ─── deshacer_corte: no deja canjes de premios que ya no se ganaron ─────────
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
  v_antes jsonb;
  v_despues jsonb;
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
  v_antes := public._premios_cliente(v_corte.cliente_id, v_total);
  v_despues := public._premios_cliente(v_corte.cliente_id, v_total - 1);

  -- Si este corte ganó un premio que ya se canjeó, no se puede deshacer:
  --   · en total, quedarían más canjes que premios ganados (como antes), o
  --   · en su etapa, quedarían más canjes de esa etapa que premios ganados.
  if v_despues is not null and jsonb_array_length(v_despues) > 0 and (
    (select coalesce(sum((e ->> 'ganados')::integer), 0) from jsonb_array_elements(v_despues) e)
      < v_canjes
    or exists (
      select 1
      from jsonb_array_elements(v_antes) a
      join jsonb_array_elements(v_despues) d on (a ->> 'corte') = (d ->> 'corte')
      where (d ->> 'canjeados')::integer > (d ->> 'ganados')::integer
        and (a ->> 'canjeados')::integer <= (a ->> 'ganados')::integer
    )
  ) then
    raise exception using errcode = 'P0001', message = 'premio_ya_canjeado',
      hint = 'Este corte ganó un premio que ya fue canjeado.';
  end if;

  delete from public.cortes where id = p_corte_id;
end;
$$;

comment on function public.deshacer_corte(uuid) is
  'Borra un corte cargado hace menos de 10 minutos si no ganó un premio ya canjeado. El dueño, cualquiera; el empleado, solo los suyos.';

-- ─── guardar_regla_etapas: solo el dueño ────────────────────────────────────
-- Recibe las etapas en cualquier orden ([{corte, descripcion}]), las ordena,
-- les quita espacios y las valida. Desactiva la regla anterior y crea la nueva
-- en la misma transacción. Si son iguales a las vigentes, no crea otra versión.
create or replace function public.guardar_regla_etapas(p_etapas jsonb)
returns public.reglas
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actual public.reglas;
  v_nueva public.reglas;
  v_etapas jsonb;
begin
  perform public._exigir_dueno();

  if p_etapas is null
    or jsonb_typeof(p_etapas) <> 'array'
    or exists (
      select 1 from jsonb_array_elements(p_etapas) e
      where jsonb_typeof(e) <> 'object'
        or jsonb_typeof(e -> 'corte') <> 'number'
        or (e ->> 'corte') !~ '^[0-9]{1,2}$'
        or jsonb_typeof(e -> 'descripcion') <> 'string'
    ) then
    raise exception using errcode = '22023', message = 'etapas_invalidas',
      hint = 'Cada etapa necesita un número de corte (entero) y una descripción.';
  end if;

  select jsonb_agg(
    jsonb_build_object('corte', (e ->> 'corte')::integer, 'descripcion', btrim(e ->> 'descripcion'))
    order by (e ->> 'corte')::integer
  )
  into v_etapas
  from jsonb_array_elements(p_etapas) e;

  if not public._etapas_validas(v_etapas) then
    raise exception using errcode = '22023', message = 'etapas_invalidas',
      hint = 'Entre 1 y 6 etapas, cortes distintos del 1 al 30 y premios de 3 a 120 caracteres.';
  end if;

  -- Serializa los cambios de regla.
  lock table public.reglas in share row exclusive mode;

  select * into v_actual from public.reglas where activa limit 1;
  if found and v_actual.etapas = v_etapas then
    return v_actual;
  end if;

  update public.reglas set activa = false where activa;

  insert into public.reglas (cortes_necesarios, descripcion_premio, etapas, activa)
  values (
    (v_etapas -> -1 ->> 'corte')::integer,
    v_etapas -> -1 ->> 'descripcion',
    v_etapas,
    true
  )
  returning * into v_nueva;

  return v_nueva;
end;
$$;

comment on function public.guardar_regla_etapas(jsonb) is
  'Reemplaza la regla activa por una de etapas (la anterior queda en el historial). Solo el dueño.';

-- La versión anterior ("cada N cortes, un premio") crea una regla de una etapa.
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
begin
  perform public._exigir_dueno();
  return public.guardar_regla_etapas(jsonb_build_array(
    jsonb_build_object('corte', p_cortes_necesarios, 'descripcion', coalesce(p_descripcion_premio, ''))
  ));
end;
$$;

comment on function public.guardar_regla(integer, text) is
  'Compatibilidad: guarda una regla de una sola etapa ("cada N cortes"). Solo el dueño.';

-- ─── Permisos de funciones ──────────────────────────────────────────────────
revoke execute on function
  public._etapas_validas(jsonb),
  public._sincronizar_regla(),
  public._repartir_premios(integer, jsonb, integer[]),
  public._premios_cliente(uuid, integer),
  public.canjear_premio(uuid, uuid, integer),
  public.guardar_regla_etapas(jsonb)
from public, anon, authenticated;

-- _repartir_premios() se evalúa en la vista (security_invoker): es pura, no lee tablas.
grant execute on function
  public._repartir_premios(integer, jsonb, integer[]),
  public.canjear_premio(uuid, uuid, integer),
  public.guardar_regla_etapas(jsonb)
to authenticated;

grant select on table public.resumen_clientes to service_role;

-- Que la API (PostgREST) vea enseguida las columnas y funciones nuevas.
notify pgrst, 'reload schema';
