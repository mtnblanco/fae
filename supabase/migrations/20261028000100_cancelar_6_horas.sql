-- ─── Turnos: el cliente cancela hasta 6 horas antes ────────────────────────
-- Antes eran 3. Ahora, si faltan 6 horas o menos, la web ya no lo deja
-- cancelar (le aparece el botón de WhatsApp). El barbero sigue pudiendo
-- cancelar siempre desde la agenda. Mismo cuerpo que 20261025000100_seguridad,
-- cambiando solo el plazo.
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
    if v_turno.estado = 'reservado' and v_turno.inicio - public._ahora() <= interval '6 hours' then
      raise exception using errcode = 'P0001', message = 'cancelacion_tardia',
        hint = 'Faltan 6 horas o menos: hay que avisar por WhatsApp.';
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
  'Cancela un turno o quita un bloqueo. Cliente: los suyos, con más de 6 h de anticipación y hasta 3 cada 24 h. Empleado: su agenda. Dueño: todos.';

-- Próximo turno del cliente (y si todavía lo puede cancelar).
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
         t.inicio - public._ahora() > interval '6 hours'
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
