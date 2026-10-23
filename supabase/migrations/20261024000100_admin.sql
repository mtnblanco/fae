-- ════════════════════════════════════════════════════════════════════════════
-- Perfil ADMIN: ve y configura todo como el dueño, pero NO es barbero que atiende.
--
-- Caso: la cuenta "dueño" de producción es del desarrollador (supervisa y da
-- soporte, no corta). El dueño real de la barbería, que sí atiende, tiene su
-- propia cuenta de dueño.
--
-- Modelo: admin = barbero con es_dueno = true y es_admin = true. Así todos los
-- chequeos de permisos que ya existen (es_barbero(), es_dueno(),
-- _exigir_dueno(), RLS, proxy y guards de la app) le dan lo mismo que al dueño,
-- sin tocarlos. Lo único que cambia es "quién atiende":
--   · _es_barbero_id() deja afuera a los admins → no se les pueden cargar
--     horarios, días especiales, bloqueos ni turnos (ni reservar con ellos),
--     y no tienen agenda.
--   · barberos_turnos() no los ofrece a los clientes.
--   · facturacion() los muestra solo si cargaron cortes (con es_admin = true,
--     para que la caja los marque como "Admin").
--   · guardar_suscripcion_push() no los suscribe (nunca reciben avisos).
--
-- Pensada para aplicarse sobre una base EN USO:
--   · NO marca a nadie como admin (eso lo hace supabase/marcar-admin.sql).
--     Mientras nadie sea admin, todo funciona exactamente igual que antes.
--   · facturacion() suma una columna al final: la versión publicada de la app
--     la ignora. El resto de las funciones mantiene su firma.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── perfiles.es_admin ──────────────────────────────────────────────────────
alter table public.perfiles
  add column if not exists es_admin boolean not null default false;

-- Admin implica dueño (y dueño implica barbero: perfiles_dueno_es_barbero).
alter table public.perfiles
  add constraint perfiles_admin_es_dueno check (not es_admin or es_dueno);

comment on column public.perfiles.es_admin is
  'Solo dueños. true = admin: mismos permisos que el dueño, pero no atiende (sin horarios, turnos ni agenda propia). Se marca con supabase/marcar-admin.sql.';

-- ─── Barberos que atienden ──────────────────────────────────────────────────
-- Lo usan horarios_libres, reservar_turno y _exigir_agenda (y por ella
-- agenda_dia, reservar_para_cliente, bloquear_horario, guardar_horario_semanal,
-- guardar_dia_especial y borrar_dia_especial): para un admin responden
-- "barbero_inexistente", igual que para cualquier id que no sea de un barbero.
create or replace function public._es_barbero_id(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = p_id and rol = 'barbero' and not es_admin
  );
$$;

comment on function public._es_barbero_id(uuid) is
  'true si el id es de un barbero que atiende (dueño o empleado; no admin).';

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
    and not p.es_admin
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
  'Barberos que atienden (no admins) con horario cargado y su próximo horario libre. Solo nombre: nada de datos privados.';

-- ─── facturacion: el admin, solo si cargó cortes ────────────────────────────
-- Cambia el tipo de retorno (suma es_admin al final): hay que recrearla.
drop function if exists public.facturacion(date, date);

create function public.facturacion(p_desde date, p_hasta date)
returns table (
  barbero_id uuid,
  barbero_nombre text,
  es_dueno boolean,
  cortes integer,
  cortes_sin_monto integer,
  total numeric,
  es_admin boolean
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
      coalesce(sum(c.monto), 0)::numeric as total,
      b.es_admin
    from public.perfiles b
    left join c on c.registrado_por = b.id
    where b.rol = 'barbero'
    group by b.id, b.nombre, b.es_dueno, b.es_admin
    -- Los barberos que atienden aparecen siempre; el admin, solo si cargó cortes.
    having not b.es_admin or count(c.registrado_por) > 0
  ),
  sin_barbero as (
    select
      null::uuid as barbero_id,
      null::text as barbero_nombre,
      false as es_dueno,
      count(*)::integer as cortes,
      (count(*) filter (where c.monto is null))::integer as cortes_sin_monto,
      coalesce(sum(c.monto), 0)::numeric as total,
      false as es_admin
    from c
    where c.registrado_por is null
    having count(*) > 0
  )
  select x.barbero_id, x.barbero_nombre, x.es_dueno, x.cortes, x.cortes_sin_monto, x.total, x.es_admin
  from (
    select * from por_barbero
    union all
    select * from sin_barbero
  ) x
  order by x.barbero_id is null, x.es_admin, x.es_dueno desc, x.barbero_nombre;
end;
$$;

comment on function public.facturacion(date, date) is
  'Cortes y total cobrado por barbero entre dos fechas (inclusive, hora argentina). El admin aparece solo si cargó cortes. Solo el dueño.';

revoke execute on function public.facturacion(date, date) from public, anon, authenticated;
grant execute on function public.facturacion(date, date) to authenticated;

-- ─── Notificaciones: el admin no recibe avisos de turnos ────────────────────
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

  if not public._es_barbero_id((select auth.uid())) then
    raise exception using errcode = '42501', message = 'no_autorizado',
      hint = 'El admin no tiene turnos: no recibe notificaciones.';
  end if;

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
