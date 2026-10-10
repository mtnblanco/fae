-- ════════════════════════════════════════════════════════════════════════════
-- Seguridad: RLS en TODAS las tablas, permisos mínimos y policies.
--
-- Modelo:
--   · anon (sin login): solo lee la regla de premios activa (para la landing).
--   · cliente: solo LEE su perfil, sus cortes y canjes, la regla activa y los
--     descuentos vigentes. No escribe nada (su contraseña la cambia por Auth).
--   · barbero: lee todo; escribe descuentos directo y cortes/canjes/reglas solo
--     a través de funciones que validan las reglas de negocio.
--   · service_role (solo en el servidor): alta, edición y baja de usuarios.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.perfiles enable row level security;
alter table public.cortes enable row level security;
alter table public.canjes enable row level security;
alter table public.reglas enable row level security;
alter table public.descuentos_asociados enable row level security;

-- ─── Permisos de tabla (defensa en profundidad, además del RLS) ─────────────
-- Supabase otorga todo a anon/authenticated por defecto: lo recortamos.
revoke all on table
  public.perfiles,
  public.cortes,
  public.canjes,
  public.reglas,
  public.descuentos_asociados
from anon, authenticated;

revoke all on table public.resumen_clientes from anon, authenticated;

grant select on table
  public.perfiles,
  public.cortes,
  public.canjes,
  public.reglas,
  public.descuentos_asociados,
  public.resumen_clientes
to authenticated;

-- Solo el barbero (validado por RLS) escribe descuentos de forma directa.
grant insert, update, delete on table public.descuentos_asociados to authenticated;

-- La landing muestra la regla activa.
grant select on table public.reglas to anon;

-- service_role (solo en el servidor) administra usuarios y perfiles. Se otorga
-- explícito por si el proyecto tiene desactivados los permisos automáticos.
grant usage on schema public to service_role;
grant all on table
  public.perfiles,
  public.cortes,
  public.canjes,
  public.reglas,
  public.descuentos_asociados
to service_role;
grant select on table public.resumen_clientes to service_role;

-- ─── Permisos de funciones ──────────────────────────────────────────────────
revoke execute on function
  public.es_barbero(),
  public._exigir_barbero(),
  public._bloquear_cliente(uuid),
  public.registrar_corte(uuid, uuid),
  public.deshacer_corte(uuid),
  public.canjear_premio(uuid, uuid),
  public.guardar_regla(integer, text),
  public.metricas_panel(),
  public.hoy_ar()
from public, anon, authenticated;

-- es_barbero() y hoy_ar() se evalúan dentro de las policies.
grant execute on function public.es_barbero(), public.hoy_ar() to authenticated;
grant execute on function public.hoy_ar() to anon;

-- Operaciones del panel (cada una vuelve a verificar que sea barbero).
grant execute on function
  public.registrar_corte(uuid, uuid),
  public.deshacer_corte(uuid),
  public.canjear_premio(uuid, uuid),
  public.guardar_regla(integer, text),
  public.metricas_panel()
to authenticated;

-- ─── Policies: perfiles ─────────────────────────────────────────────────────
-- Sin policies de escritura: los perfiles se crean/editan con service_role.
create policy "perfiles: cada uno ve el suyo; el barbero ve todos"
  on public.perfiles
  for select
  to authenticated
  using (id = (select auth.uid()) or (select public.es_barbero()));

-- ─── Policies: cortes ───────────────────────────────────────────────────────
-- Sin policies de escritura: solo registrar_corte() / deshacer_corte().
create policy "cortes: el cliente ve los suyos; el barbero ve todos"
  on public.cortes
  for select
  to authenticated
  using (cliente_id = (select auth.uid()) or (select public.es_barbero()));

-- ─── Policies: canjes ───────────────────────────────────────────────────────
-- Sin policies de escritura: solo canjear_premio().
create policy "canjes: el cliente ve los suyos; el barbero ve todos"
  on public.canjes
  for select
  to authenticated
  using (cliente_id = (select auth.uid()) or (select public.es_barbero()));

-- ─── Policies: reglas ───────────────────────────────────────────────────────
-- Sin policies de escritura: solo guardar_regla().
create policy "reglas: todos ven la activa"
  on public.reglas
  for select
  to anon
  using (activa);

create policy "reglas: autenticados ven la activa; el barbero ve el historial"
  on public.reglas
  for select
  to authenticated
  using (activa or (select public.es_barbero()));

-- ─── Policies: descuentos_asociados ─────────────────────────────────────────
create policy "descuentos: el cliente ve los vigentes; el barbero ve todos"
  on public.descuentos_asociados
  for select
  to authenticated
  using (
    (select public.es_barbero())
    or (
      activo
      and vigente_desde <= (select public.hoy_ar())
      and (vigente_hasta is null or vigente_hasta >= (select public.hoy_ar()))
    )
  );

create policy "descuentos: el barbero crea"
  on public.descuentos_asociados
  for insert
  to authenticated
  with check ((select public.es_barbero()));

create policy "descuentos: el barbero edita"
  on public.descuentos_asociados
  for update
  to authenticated
  using ((select public.es_barbero()))
  with check ((select public.es_barbero()));

create policy "descuentos: el barbero borra"
  on public.descuentos_asociados
  for delete
  to authenticated
  using ((select public.es_barbero()));
