-- ─── deshacer_corte: el dueño corrige los cortes del día ───────────────────
-- El empleado sigue igual: solo los suyos y dentro de los 10 minutos.
-- El dueño (y el admin) puede deshacer cualquier corte cargado HOY (hora de
-- Argentina), por si se dio cuenta del error más tarde. Siempre vale lo de
-- antes: no se deshace un corte que ganó un premio ya canjeado.
create or replace function public.deshacer_corte(p_corte_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_corte public.cortes;
  v_dueno boolean;
  v_total integer;
  v_canjes integer;
  v_antes jsonb;
  v_despues jsonb;
begin
  perform public._exigir_barbero();
  v_dueno := public.es_dueno();

  select * into v_corte from public.cortes where id = p_corte_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'corte_inexistente',
      hint = 'El corte no existe o ya se deshizo.';
  end if;

  if not v_dueno and v_corte.registrado_por is distinct from (select auth.uid()) then
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

  if v_corte.fecha < now() - interval '10 minutes' and not (
    v_dueno
    and (v_corte.fecha at time zone 'America/Argentina/Buenos_Aires')::date
      = (now() at time zone 'America/Argentina/Buenos_Aires')::date
  ) then
    raise exception using errcode = 'P0001', message = 'fuera_de_plazo',
      hint = 'El empleado deshace dentro de los 10 minutos; el dueño, en el mismo día.';
  end if;

  select count(*) into v_total from public.cortes where cliente_id = v_corte.cliente_id;
  select count(*) into v_canjes from public.canjes where cliente_id = v_corte.cliente_id;
  v_antes := public._premios_cliente(v_corte.cliente_id, v_total);
  v_despues := public._premios_cliente(v_corte.cliente_id, v_total - 1);

  -- Si este corte ganó un premio que ya se canjeó, no se puede deshacer:
  --   · en total, quedarían más canjes que premios ganados, o
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
  'Borra un corte si no ganó un premio ya canjeado. El empleado: los suyos, dentro de los 10 minutos. El dueño: cualquiera, dentro de los 10 minutos o del mismo día.';
