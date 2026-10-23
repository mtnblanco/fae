-- ════════════════════════════════════════════════════════════════════════════
-- Convertir una cuenta de DUEÑO en ADMIN.
--
-- El admin ve y configura todo, igual que el dueño (caja, montos de todos los
-- cortes, las dos agendas, precios, premios, descuentos, horarios de los
-- barberos, borrar clientes), pero NO es barbero que atiende:
--   · no aparece cuando un cliente saca turno,
--   · no tiene horarios, turnos ni agenda propia,
--   · no recibe notificaciones de turnos,
--   · en la caja aparece solo si sumó algún corte (con la etiqueta "Admin").
-- Puede seguir escaneando y sumando cortes (por ejemplo, para dar soporte):
-- quedan registrados con su nombre.
--
-- Pensado para la cuenta del desarrollador, que hoy figura como dueño.
-- Antes de correrlo tiene que estar aplicada la migración
-- supabase/migrations/20261024000100_admin.sql.
--
-- Abrí SQL Editor → New query, pegá este archivo, cambiá el email marcado con
-- 👉 y tocá "Run".
--
-- Qué hace con esa cuenta:
--   · Si tiene turnos de clientes reservados de hoy en adelante, NO cambia nada
--     y te avisa: primero cancelalos desde la Agenda (y avisale a cada cliente).
--   · Borra su horario semanal y sus días especiales (ya no atiende), quita sus
--     bloqueos de horario que no pasaron y apaga sus notificaciones.
--   · No toca sus cortes, canjes ni turnos ya pasados.
--
-- Se puede correr más de una vez: si la cuenta ya es admin, no cambia nada.
-- Solo funciona con una cuenta que ya es DUEÑO (así un error de tipeo nunca
-- convierte al empleado ni a un cliente en admin).
--
-- Para deshacerlo (que vuelva a ser dueño que atiende), corré en otra consulta:
--   update public.perfiles set es_admin = false
--   where id = (select id from auth.users where lower(email) = lower('tu-email@ejemplo.com'));
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_email text := 'tu-email@ejemplo.com';   -- 👉 el email de la cuenta que pasa a ser admin
  v_id uuid;
  v_es_dueno boolean;
  v_turnos integer;
begin
  select p.id, p.es_dueno into v_id, v_es_dueno
  from public.perfiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(btrim(v_email))
    and p.rol = 'barbero';

  if v_id is null then
    raise exception 'No hay ningún barbero con el email "%". Revisá que esté bien escrito: es el email con el que esa persona entra al panel.', v_email;
  end if;

  if not v_es_dueno then
    raise exception 'La cuenta "%" es de un barbero EMPLEADO, no del dueño. Por seguridad, solo una cuenta de dueño se puede convertir en admin. No se cambió nada.', v_email;
  end if;

  select count(*) into v_turnos
  from public.turnos
  where barbero_id = v_id
    and tipo = 'reserva'
    and estado = 'reservado'
    and fin > now();

  if v_turnos > 0 then
    raise exception 'La cuenta "%" tiene % turno(s) de clientes reservados de hoy en adelante. Entrá al panel con esa cuenta → Agenda, cancelalos (avisale a cada cliente por WhatsApp) y volvé a correr este archivo. No se cambió nada.', v_email, v_turnos;
  end if;

  -- Quita sus bloqueos de horario que todavía no pasaron.
  update public.turnos
  set estado = 'cancelado', cancelado_por = v_id, cancelado_en = now()
  where barbero_id = v_id
    and tipo = 'bloqueo'
    and estado <> 'cancelado'
    and fin > now();

  -- Ya no atiende: sin horario ni días especiales, y sin notificaciones.
  delete from public.horarios_semanales where barbero_id = v_id;
  delete from public.dias_especiales where barbero_id = v_id;
  delete from public.suscripciones_push where barbero_id = v_id;

  update public.perfiles
  set es_admin = true
  where id = v_id;

  raise notice 'Listo: "%" ahora es admin.', v_email;
end;
$$;

-- Verificación: la cuenta de arriba tiene que figurar con es_admin = true, y el
-- dueño que atiende y el empleado, con es_admin = false.
select p.nombre, u.email, p.es_dueno, p.es_admin
from public.perfiles p
join auth.users u on u.id = p.id
where p.rol = 'barbero'
order by p.es_admin desc, p.es_dueno desc, p.nombre;
