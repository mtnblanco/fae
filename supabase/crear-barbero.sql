-- ════════════════════════════════════════════════════════════════════════════
-- Crear el barbero DUEÑO: el dueño de la barbería, que corta y atiende turnos,
-- y además ve la caja, los montos y configura todo.
--
-- Para sumar un barbero EMPLEADO usá crear-empleado.sql (no este archivo).
-- Para que una cuenta vea todo pero NO atienda (la del desarrollador), usá
-- marcar-admin.sql.
--
-- Paso 1 — En Supabase: Authentication → Users → "Add user" → "Create new user".
--          Cargá el email del dueño y una contraseña, y tildá "Auto Confirm User".
--
-- Paso 2 — Abrí SQL Editor, pegá este archivo, cambiá los dos valores marcados
--          con 👉 y tocá "Run".
--
-- Se puede correr más de una vez: si el perfil ya existe, lo convierte en barbero dueño.
-- Nunca toca a un admin: si por error ponés el email del admin, sigue siendo admin.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.perfiles (id, nombre, telefono, rol, debe_cambiar_password, es_dueno)
select
  u.id,
  'Tu nombre',            -- 👉 el nombre del dueño, como se va a ver en el panel y al sacar turno
  null,
  'barbero',
  false,
  true
from auth.users u
where lower(u.email) = lower('tu-email@ejemplo.com')   -- 👉 el email que usaste en el paso 1
on conflict (id) do update
  set rol = 'barbero',
      precio_habitual = null,
      debe_cambiar_password = false,
      es_dueno = true;

-- Verificación: tiene que aparecer la fila del dueño con es_dueno = true y es_admin = false
-- (si hay un admin, figura aparte con es_admin = true).
select p.nombre, u.email, p.rol, p.es_dueno, p.es_admin
from public.perfiles p
join auth.users u on u.id = p.id
where p.rol = 'barbero'
order by p.es_admin, p.es_dueno desc, p.nombre;
