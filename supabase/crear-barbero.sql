-- ════════════════════════════════════════════════════════════════════════════
-- Crear el primer barbero (administrador).
--
-- Paso 1 — En Supabase: Authentication → Users → "Add user" → "Create new user".
--          Cargá tu email y una contraseña, y tildá "Auto Confirm User".
--
-- Paso 2 — Abrí SQL Editor, pegá este archivo, cambiá los dos valores marcados
--          con 👉 y tocá "Run".
--
-- Se puede correr más de una vez: si el perfil ya existe, lo convierte en barbero.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.perfiles (id, nombre, telefono, rol, debe_cambiar_password)
select
  u.id,
  'Tu nombre',            -- 👉 tu nombre, como lo vas a ver en el panel
  null,
  'barbero',
  false
from auth.users u
where lower(u.email) = lower('tu-email@ejemplo.com')   -- 👉 el email que usaste en el paso 1
on conflict (id) do update
  set rol = 'barbero',
      debe_cambiar_password = false;

-- Verificación: tiene que aparecer una fila con rol = barbero.
select p.id, p.nombre, p.rol, u.email
from public.perfiles p
join auth.users u on u.id = p.id
where p.rol = 'barbero';
