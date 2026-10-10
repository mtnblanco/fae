-- ════════════════════════════════════════════════════════════════════════════
-- Datos de ejemplo para PROBAR la app. ⚠️ NO correr en producción.
--
-- Crea:
--   · 1 barbero:   email barbero@faebarbershop.test   / contraseña barbero123
--   · 12 clientes: teléfono (ver tabla abajo)     / contraseña cliente123
--   · 1 cliente nuevo que debe cambiar la contraseña:
--                  teléfono 2346409999            / contraseña nuevo1234
--   · Cortes y canjes repartidos en los últimos meses, y descuentos asociados.
--
-- Los emails internos de los clientes usan el dominio por defecto
-- (clientes.local). Si cambiaste CLIENTES_EMAIL_DOMAIN, cambialo acá también.
-- ════════════════════════════════════════════════════════════════════════════

-- Crea un usuario de Supabase Auth con email/contraseña ya confirmado.
create or replace function pg_temp.crear_usuario(p_id uuid, p_email text, p_password text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  )
  on conflict do nothing;
end;
$$;

-- ─── Barbero ────────────────────────────────────────────────────────────────
select pg_temp.crear_usuario('b0000000-0000-4000-8000-000000000001', 'barbero@faebarbershop.test', 'barbero123');

insert into public.perfiles (id, nombre, telefono, rol, debe_cambiar_password, created_at)
values ('b0000000-0000-4000-8000-000000000001', 'Leandro Ferreyra', null, 'barbero', false, now() - interval '200 days')
on conflict (id) do nothing;

-- ─── Clientes ───────────────────────────────────────────────────────────────
create temporary table seed_clientes (
  id uuid,
  nombre text,
  telefono text,
  cortes integer,
  canjes integer,
  dias_alta integer
);

insert into seed_clientes values
  ('c0000000-0000-4000-8000-000000000001', 'Juan Pérez',          '2346401122', 4,  0, 120),
  ('c0000000-0000-4000-8000-000000000002', 'Martín Gómez',        '2346402233', 5,  0, 110),
  ('c0000000-0000-4000-8000-000000000003', 'Lucas Fernández',     '2346403344', 12, 2, 190),
  ('c0000000-0000-4000-8000-000000000004', 'Santiago Rodríguez',  '2346404455', 3,  0, 60),
  ('c0000000-0000-4000-8000-000000000005', 'Facundo López',       '2346405566', 10, 1, 170),
  ('c0000000-0000-4000-8000-000000000006', 'Nicolás Díaz',        '2346406677', 1,  0, 20),
  ('c0000000-0000-4000-8000-000000000007', 'Tomás Martínez',      '2346407788', 7,  1, 150),
  ('c0000000-0000-4000-8000-000000000008', 'Agustín Romero',      '2346408899', 0,  0, 5),
  ('c0000000-0000-4000-8000-000000000009', 'Matías Sosa',         '2346410011', 9,  1, 160),
  ('c0000000-0000-4000-8000-000000000010', 'Ezequiel Álvarez',    '2346411122', 2,  0, 45),
  ('c0000000-0000-4000-8000-000000000011', 'Franco Benítez',      '2346412233', 6,  1, 140),
  ('c0000000-0000-4000-8000-000000000012', 'Joaquín Torres',      '2346413344', 15, 2, 200),
  ('c0000000-0000-4000-8000-000000000013', 'Bruno Acosta',        '2346409999', 0,  0, 0);

select pg_temp.crear_usuario(
  id,
  telefono || '@clientes.local',
  case when telefono = '2346409999' then 'nuevo1234' else 'cliente123' end
)
from seed_clientes;

insert into public.perfiles (id, nombre, telefono, rol, debe_cambiar_password, created_at)
select id, nombre, telefono, 'cliente', telefono = '2346409999',
       now() - make_interval(days => greatest(dias_alta, cortes * 16 + 12))
from seed_clientes
on conflict (id) do nothing;

-- Cortes: el más reciente hace 0–9 días, y los anteriores cada ~16 días.
insert into public.cortes (cliente_id, fecha, registrado_por)
select
  c.id,
  now()
    - make_interval(days => (g - 1) * 16 + abs(hashtext(c.id::text)) % 10)
    - make_interval(hours => 2 + abs(hashtext(c.id::text || g::text)) % 8),
  'b0000000-0000-4000-8000-000000000001'
from seed_clientes c
cross join lateral generate_series(1, c.cortes) as g
where not exists (select 1 from public.cortes where cliente_id = c.id);

-- Canjes: después del corte que completó cada premio.
insert into public.canjes (cliente_id, fecha, registrado_por, premio_descripcion)
select
  c.id,
  now() - make_interval(days => (c.cortes - g * 5) * 16 + abs(hashtext(c.id::text)) % 10 - 1),
  'b0000000-0000-4000-8000-000000000001',
  '50% off en el siguiente corte'
from seed_clientes c
cross join lateral generate_series(1, c.canjes) as g
where not exists (select 1 from public.canjes where cliente_id = c.id);

-- ─── Descuentos asociados ───────────────────────────────────────────────────
insert into public.descuentos_asociados (comercio, descripcion, vigente_desde, vigente_hasta, activo)
select * from (values
  ('Café del Centro',      '15% off en cualquier café o desayuno mostrando tu carnet.',          public.hoy_ar() - 60, null::date,             true),
  ('Gimnasio Olimpo',      'Primer mes con 20% de descuento en la cuota mensual.',               public.hoy_ar() - 30, public.hoy_ar() + 90,   true),
  ('Indumentaria Raíces',  '10% off en compras mayores a $30.000. No acumulable con promos.',    public.hoy_ar() - 10, public.hoy_ar() + 45,   true),
  ('Lavadero El Torito',   'Los martes, lavado completo de auto al precio del lavado simple.',   public.hoy_ar() - 90, null::date,             true),
  ('Pizzería Don Ángel',   '2x1 en muzzarella los jueves.',                                     public.hoy_ar() - 120, public.hoy_ar() - 5,   true),
  ('Óptica Visión',        '25% off en anteojos de sol.',                                       public.hoy_ar() - 20, null::date,             false)
) as d(comercio, descripcion, desde, hasta, activo)
where not exists (select 1 from public.descuentos_asociados);

drop table seed_clientes;
