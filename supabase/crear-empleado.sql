-- ════════════════════════════════════════════════════════════════════════════
-- Sumar un barbero EMPLEADO.
--
-- El empleado puede: buscar y escanear clientes, darlos de alta, sumar cortes
-- (ve el precio del cliente para cobrarlo), deshacer SUS cortes dentro de los
-- 10 minutos y canjear premios. En el historial ve solo los cortes que cargó él.
-- NO ve la caja, ni los montos ni los cortes del otro barbero, ni puede cambiar
-- precios, la regla de premios o los descuentos, ni borrar clientes.
--
-- Paso 1 — En Supabase: Authentication → Users → "Add user" → "Create new user".
--          Cargá el email del empleado y una contraseña, y tildá "Auto Confirm User".
--
-- Paso 2 — Abrí SQL Editor, pegá este archivo, cambiá los dos valores marcados
--          con 👉 y tocá "Run".
--
-- Se puede correr más de una vez. Nunca le quita el rol de dueño a nadie: si por
-- error ponés el email del dueño, el dueño sigue siendo dueño.
-- ════════════════════════════════════════════════════════════════════════════

insert into public.perfiles (id, nombre, telefono, rol, debe_cambiar_password, es_dueno)
select
  u.id,
  'Nombre del empleado',  -- 👉 su nombre, como va a aparecer en cada corte que cargue
  null,
  'barbero',
  false,
  false
from auth.users u
where lower(u.email) = lower('empleado@ejemplo.com')   -- 👉 el email que usaste en el paso 1
on conflict (id) do update
  set rol = 'barbero',
      precio_habitual = null,
      debe_cambiar_password = false;

-- Verificación: tienen que aparecer el dueño (es_dueno = true) y el empleado
-- (es_dueno = false).
select p.nombre, p.rol, p.es_dueno, u.email
from public.perfiles p
join auth.users u on u.id = p.id
where p.rol = 'barbero'
order by p.es_dueno desc, p.nombre;
