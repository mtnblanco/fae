-- ════════════════════════════════════════════════════════════════════════════
-- Foto del local en cada descuento (opcional, una por descuento).
--
--   · La imagen va en su propia tabla (fotos_descuentos), en base64, para que
--     los listados de descuentos sigan siendo livianos. No usamos Supabase
--     Storage: así funciona igual en el modo local (scripts/supabase-local.mjs).
--   · descuentos_asociados.foto_actualizada_en: null = sin foto; si no, la
--     versión de la foto (la URL lleva ?v=<epoch> para el caché del navegador).
--     Solo la escriben las funciones de abajo.
--   · Solo el dueño (o el admin) pone, cambia o quita la foto, con
--     guardar_foto_descuento() / quitar_foto_descuento(), que validan tipo
--     (WebP o JPEG), tamaño (hasta 400 KB) y los bytes del archivo.
--   · Ve la foto quien ve el descuento (el mismo RLS de descuentos_asociados):
--     el cliente, la de los vigentes; los barberos, todas.
--
-- Pensada para aplicarse sobre una base EN USO: solo agrega una columna
-- nullable, una tabla y dos funciones. La versión publicada de la app sigue
-- funcionando igual (edita los descuentos con las mismas columnas).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Versión de la foto en el descuento ─────────────────────────────────────
alter table public.descuentos_asociados
  add column if not exists foto_actualizada_en timestamptz;

comment on column public.descuentos_asociados.foto_actualizada_en is
  'Cuándo se cargó la foto del local (null = sin foto). La mantienen guardar_foto_descuento() y quitar_foto_descuento().';

-- El dueño sigue escribiendo los descuentos directo (RLS), pero solo las
-- columnas del formulario: foto_actualizada_en la escriben las funciones.
revoke insert, update on table public.descuentos_asociados from authenticated;
grant insert (comercio, descripcion, vigente_desde, vigente_hasta, activo)
  on table public.descuentos_asociados to authenticated;
grant update (comercio, descripcion, vigente_desde, vigente_hasta, activo)
  on table public.descuentos_asociados to authenticated;

-- ─── fotos_descuentos ───────────────────────────────────────────────────────
-- 400 KB en base64 son como mucho 546.136 caracteres.
create table if not exists public.fotos_descuentos (
  descuento_id uuid primary key references public.descuentos_asociados (id) on delete cascade,
  tipo text not null,
  foto text not null,
  actualizada_en timestamptz not null default now(),

  constraint fotos_descuentos_tipo_valido check (tipo in ('image/webp', 'image/jpeg')),
  constraint fotos_descuentos_tamano check (char_length(foto) between 16 and 546136),
  constraint fotos_descuentos_base64 check (
    char_length(foto) % 4 = 0 and foto ~ '^[A-Za-z0-9+/]+={0,2}$'
  )
);

comment on table public.fotos_descuentos is
  'Foto del local de cada descuento (WebP o JPEG en base64, hasta 400 KB). La escribe el dueño con guardar_foto_descuento().';

alter table public.fotos_descuentos enable row level security;

revoke all on table public.fotos_descuentos from anon, authenticated;
grant select on table public.fotos_descuentos to authenticated;
grant all on table public.fotos_descuentos to service_role;

-- Quien ve el descuento ve su foto: la subconsulta aplica el RLS de
-- descuentos_asociados (el cliente, solo los vigentes; los barberos, todos).
drop policy if exists "fotos de descuentos: las ve quien ve el descuento" on public.fotos_descuentos;
create policy "fotos de descuentos: las ve quien ve el descuento"
  on public.fotos_descuentos
  for select
  to authenticated
  using (exists (
    select 1 from public.descuentos_asociados d where d.id = fotos_descuentos.descuento_id
  ));

-- ─── Poner o cambiar la foto ────────────────────────────────────────────────
-- Devuelve la versión nueva (foto_actualizada_en).
create or replace function public.guardar_foto_descuento(
  p_descuento uuid,
  p_tipo text,
  p_foto text
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_ahora timestamptz := clock_timestamp();
begin
  perform public._exigir_dueno();

  if p_descuento is null
     or p_tipo is null or p_tipo not in ('image/webp', 'image/jpeg')
     or p_foto is null or char_length(p_foto) not between 16 and 546136
     or char_length(p_foto) % 4 <> 0
     or p_foto !~ '^[A-Za-z0-9+/]+={0,2}$' then
    raise exception using errcode = '22023', message = 'foto_invalida',
      hint = 'La foto tiene que ser WebP o JPEG de hasta 400 KB.';
  end if;

  v_bytes := decode(p_foto, 'base64');

  -- Que los bytes sean de verdad lo que dice el tipo.
  if octet_length(v_bytes) > 409600
     or (p_tipo = 'image/jpeg' and substring(v_bytes from 1 for 3) <> '\xffd8ff'::bytea)
     or (p_tipo = 'image/webp' and (
       substring(v_bytes from 1 for 4) <> '\x52494646'::bytea      -- "RIFF"
       or substring(v_bytes from 9 for 4) <> '\x57454250'::bytea   -- "WEBP"
     )) then
    raise exception using errcode = '22023', message = 'foto_invalida',
      hint = 'La foto tiene que ser WebP o JPEG de hasta 400 KB.';
  end if;

  perform 1 from public.descuentos_asociados where id = p_descuento for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'descuento_inexistente',
      hint = 'El descuento no existe.';
  end if;

  insert into public.fotos_descuentos (descuento_id, tipo, foto, actualizada_en)
  values (p_descuento, p_tipo, p_foto, v_ahora)
  on conflict (descuento_id) do update
    set tipo = excluded.tipo,
        foto = excluded.foto,
        actualizada_en = excluded.actualizada_en;

  update public.descuentos_asociados
  set foto_actualizada_en = v_ahora
  where id = p_descuento;

  return v_ahora;
end;
$$;

comment on function public.guardar_foto_descuento(uuid, text, text) is
  'Pone o reemplaza la foto del local de un descuento (WebP/JPEG en base64, hasta 400 KB). Solo el dueño.';

-- ─── Quitar la foto ─────────────────────────────────────────────────────────
create or replace function public.quitar_foto_descuento(p_descuento uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public._exigir_dueno();

  perform 1 from public.descuentos_asociados where id = p_descuento for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'descuento_inexistente',
      hint = 'El descuento no existe.';
  end if;

  delete from public.fotos_descuentos where descuento_id = p_descuento;
  update public.descuentos_asociados
  set foto_actualizada_en = null
  where id = p_descuento;
end;
$$;

comment on function public.quitar_foto_descuento(uuid) is
  'Quita la foto del local de un descuento. Solo el dueño.';

-- ─── Permisos de funciones ──────────────────────────────────────────────────
revoke execute on function
  public.guardar_foto_descuento(uuid, text, text),
  public.quitar_foto_descuento(uuid)
from public, anon;

grant execute on function
  public.guardar_foto_descuento(uuid, text, text),
  public.quitar_foto_descuento(uuid)
to authenticated, service_role;
