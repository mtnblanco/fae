-- ════════════════════════════════════════════════════════════════════════════
-- Crear el barbero DUEÑO (el administrador: ve la caja, los montos y configura todo).
--
-- Para sumar un barbero EMPLEADO usá crear-empleado.sql (no este archivo).
--
-- Paso 1 — En Supabase: Authentication → Users → "Add user" → "Create new user".
--          Cargá tu email y una contraseña, y tildá "Auto Confirm User".
--
-- Paso 2 — Abrí SQL Editor, pegá este archivo, cambiá los dos valores marcados
--          con 👉 y tocá "Run".
--
-- Se puede correr más de una vez: si el perfil ya existe, lo convierte en barbero dueño.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.perfiles (id, nombre, telefono, rol, debe_cambiar_password, es_dueno)
select
  u.id,
  'Tu nombre',            -- 👉 tu nombre, como lo vas a ver en el panel
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

-- Verificación: tiene que aparecer tu fila con rol = barbero y es_dueno = true.
select p.nombre, p.rol, p.es_dueno, u.email
from public.perfiles p
join auth.users u on u.id = p.id
where p.rol = 'barbero';
