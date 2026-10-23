-- ════════════════════════════════════════════════════════════════════════════
-- Quitarle el acceso a un barbero empleado (por ejemplo, si deja de trabajar).
--
-- No borra nada: sus cortes quedan en el historial y en la caja con su nombre.
-- Solo bloquea su usuario para que no pueda volver a entrar (si tenía la app
-- abierta, la sesión se corta sola en menos de una hora).
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

-- Verificación: el empleado tiene que figurar con banned_until = infinity.
select p.nombre, p.es_dueno, u.email, u.banned_until
from public.perfiles p
join auth.users u on u.id = p.id
where p.rol = 'barbero';
