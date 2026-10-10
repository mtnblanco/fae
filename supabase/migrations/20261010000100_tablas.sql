-- ════════════════════════════════════════════════════════════════════════════
-- Tablas, índices y constraints del programa de fidelización.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm with schema extensions;

-- Fecha "de hoy" en Argentina (Supabase corre en UTC).
create or replace function public.hoy_ar()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- ─── perfiles ───────────────────────────────────────────────────────────────
-- Un perfil por usuario de Supabase Auth. El rol define qué puede hacer.
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  telefono text unique,
  rol text not null default 'cliente',
  debe_cambiar_password boolean not null default true,
  created_at timestamptz not null default now(),
  -- Texto para buscar: nombre sin tildes y en minúscula + teléfono.
  busqueda text generated always as (
    lower(translate(nombre, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) || ' ' || coalesce(telefono, '')
  ) stored,

  constraint perfiles_nombre_largo check (char_length(btrim(nombre)) between 2 and 80),
  constraint perfiles_telefono_formato check (telefono ~ '^[0-9]{8,15}$'),
  constraint perfiles_rol_valido check (rol in ('barbero', 'cliente')),
  constraint perfiles_cliente_con_telefono check (rol = 'barbero' or telefono is not null)
);

comment on table public.perfiles is 'Datos de cada usuario (barbero o cliente). El teléfono es el usuario del cliente.';
comment on column public.perfiles.debe_cambiar_password is 'Si es true, el usuario debe cambiar la contraseña antes de usar la app.';

create index perfiles_rol_created_idx on public.perfiles (rol, created_at desc);
create index perfiles_busqueda_trgm_idx on public.perfiles using gin (busqueda extensions.gin_trgm_ops);

-- ─── cortes ─────────────────────────────────────────────────────────────────
create table public.cortes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfiles (id) on delete cascade,
  fecha timestamptz not null default now(),
  registrado_por uuid references public.perfiles (id) on delete set null,
  -- Clave de idempotencia: evita duplicados por doble toque o reintentos.
  solicitud_id uuid unique
);

comment on table public.cortes is 'Cada corte registrado a un cliente. Suma un sello.';

create index cortes_cliente_fecha_idx on public.cortes (cliente_id, fecha desc);
create index cortes_registrado_por_idx on public.cortes (registrado_por);
create index cortes_fecha_idx on public.cortes (fecha desc);

-- ─── canjes ─────────────────────────────────────────────────────────────────
create table public.canjes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.perfiles (id) on delete cascade,
  fecha timestamptz not null default now(),
  registrado_por uuid references public.perfiles (id) on delete set null,
  premio_descripcion text not null,
  solicitud_id uuid unique,

  constraint canjes_premio_largo check (char_length(btrim(premio_descripcion)) between 3 and 120)
);

comment on table public.canjes is 'Premios canjeados. Guarda la descripción del premio vigente al momento del canje.';

create index canjes_cliente_fecha_idx on public.canjes (cliente_id, fecha desc);
create index canjes_registrado_por_idx on public.canjes (registrado_por);
create index canjes_fecha_idx on public.canjes (fecha desc);

-- ─── reglas ─────────────────────────────────────────────────────────────────
create table public.reglas (
  id uuid primary key default gen_random_uuid(),
  cortes_necesarios integer not null,
  descripcion_premio text not null,
  activa boolean not null default true,
  created_at timestamptz not null default now(),

  constraint reglas_cortes_rango check (cortes_necesarios between 1 and 20),
  constraint reglas_descripcion_largo check (char_length(btrim(descripcion_premio)) between 3 and 120)
);

comment on table public.reglas is 'Regla de premios. Solo una activa a la vez; las anteriores quedan como historial.';

-- Una sola regla activa a la vez.
create unique index reglas_una_activa_idx on public.reglas (activa) where activa;
create index reglas_created_idx on public.reglas (created_at desc);

-- Regla inicial, para que el programa funcione desde el primer momento.
insert into public.reglas (cortes_necesarios, descripcion_premio, activa)
values (5, '50% off en el siguiente corte', true);

-- ─── descuentos_asociados ───────────────────────────────────────────────────
create table public.descuentos_asociados (
  id uuid primary key default gen_random_uuid(),
  comercio text not null,
  descripcion text not null,
  vigente_desde date not null default public.hoy_ar(),
  vigente_hasta date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),

  constraint descuentos_comercio_largo check (char_length(btrim(comercio)) between 2 and 80),
  constraint descuentos_descripcion_largo check (char_length(btrim(descripcion)) between 3 and 280),
  constraint descuentos_vigencia_valida check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);

comment on table public.descuentos_asociados is 'Beneficios en comercios amigos de la barbería.';

create index descuentos_activo_vigencia_idx on public.descuentos_asociados (activo, vigente_desde, vigente_hasta);
create index descuentos_created_idx on public.descuentos_asociados (created_at desc);
