-- ════════════════════════════════════════════════════════════════════════════
-- Quitarle el acceso a un barbero empleado (por ejemplo, si deja de trabajar).
--
-- No borra nada: sus cortes quedan en el historial y en la caja con su nombre.
-- Bloquea su usuario para que no pueda volver a entrar y cierra sus sesiones
-- abiertas. Desde la migración 20261025000100_seguridad.sql la base, además,
-- le quita los permisos de barbero en el acto (aunque tenga la app abierta).
--
-- Abrí SQL Editor, pegá este archivo, cambiá el email marcado con 👉 y tocá "Run".
-- Para devolverle el acceso, cambiá 'infinity' por null y volvé a correrlo.
-- ════════════════════════════════════════════════════════════════════════════

update auth.users u
set banned_until = 'infinity'
from public.perfiles p
where p.id = u.id
  and p.rol = 'barbero'
  and not p.es_dueno                                    -- nunca bloquea al dueño
  and lower(u.email) = lower('empleado@ejemplo.com');   -- 👉 el email del empleado

-- Cierra todas sus sesiones (celular, compu): ninguna puede renovarse.
delete from auth.sessions s using public.perfiles p, auth.users u
where s.user_id = p.id and u.id = p.id and p.rol = 'barbero' and not p.es_dueno
  and lower(u.email) = lower('empleado@ejemplo.com');   -- 👉 el mismo email de arriba

-- Turnos online: deja de ofrecerse a los clientes (se borra su horario).
-- Los turnos que ya tenía reservados NO se borran: revisalos en la agenda
-- (como dueño: Agenda → su nombre) y cancelalos o avisale a cada cliente.
-- (Si todavía no aplicaste la migración de turnos, borrá estas dos líneas.)
delete from public.horarios_semanales h using public.perfiles p, auth.users u
where h.barbero_id = p.id and u.id = p.id and p.rol = 'barbero' and not p.es_dueno
  and lower(u.email) = lower('empleado@ejemplo.com');   -- 👉 el mismo email de arriba
delete from public.dias_especiales d using public.perfiles p, auth.users u
where d.barbero_id = p.id and u.id = p.id and p.rol = 'barbero' and not p.es_dueno
  and lower(u.email) = lower('empleado@ejemplo.com');   -- 👉 el mismo email de arriba

-- Verificación: el empleado tiene que figurar con banned_until = infinity y 0 sesiones.
select p.nombre, p.es_dueno, u.email, u.banned_until,
       (select count(*) from auth.sessions s where s.user_id = u.id) as sesiones
from public.perfiles p
join auth.users u on u.id = p.id
where p.rol = 'barbero';
