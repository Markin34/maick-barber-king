-- ============================================================================
-- Maick Barber King · Panel de administración
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run.
-- Requiere haber corrido antes 0001_reservas.sql. Se puede volver a correr hasta que corras 0003;
-- después se detiene solo (volver a correrlo rompería los cortes anotados a mano).
--
-- Seguridad:
--   • Solo los usuarios que estén en la tabla `administradores` ven y cambian reservas.
--   • Un usuario con sesión que NO sea administrador no ve nada.
--   • La clave pública (clientes) sigue sin poder leer reservas.
--   • El panel solo puede cambiar el ESTADO de una reserva, no el nombre, la hora ni el barbero.
-- ============================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'reservas' and column_name = 'origen') then
    raise exception 'NO VUELVAS A CORRER 0002: esta base ya tiene 0003 o más nuevas. No se cambió nada.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quién es administrador
-- ---------------------------------------------------------------------------
create table if not exists public.administradores (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  nombre    text,
  creado_en timestamptz not null default now()
);
comment on table public.administradores is
  'Usuarios que pueden entrar al panel /admin. Agrega aquí al dueño después de crear su usuario.';

alter table public.administradores enable row level security;
revoke all on public.administradores from anon, authenticated;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from administradores where user_id = auth.uid());
$$;
revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Nuevos estados: asistió / no vino. Siguen ocupando su hora (solo "cancelada" la libera).
-- ---------------------------------------------------------------------------
alter table public.reservas drop constraint if exists reservas_estado_check;
alter table public.reservas drop constraint if exists reservas_estado_valido;
alter table public.reservas add constraint reservas_estado_valido
  check (estado in ('confirmada', 'cancelada', 'asistio', 'no_vino'));

alter table public.reservas drop constraint if exists reservas_sin_cruces;
alter table public.reservas add constraint reservas_sin_cruces exclude using gist (
  barbero with =,
  tstzrange(inicio, fin, '[)') with &&
) where (estado <> 'cancelada');

create or replace function public.horarios_ocupados(p_barbero text, p_desde date, p_hasta date)
returns table (inicio timestamptz, fin timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with rango as (
    select
      (p_desde::timestamp at time zone 'America/La_Paz')       as desde,
      ((p_hasta + 1)::timestamp at time zone 'America/La_Paz') as hasta
    where p_hasta >= p_desde and p_hasta - p_desde <= 62
  )
  select r.inicio, r.fin
  from reservas r, rango
  where r.barbero = p_barbero
    and r.estado <> 'cancelada'
    and r.inicio < rango.hasta and r.fin > rango.desde
  union all
  select b.inicio, b.fin
  from bloqueos b, rango
  where (b.barbero is null or b.barbero = p_barbero)
    and b.inicio < rango.hasta and b.fin > rango.desde
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- Permisos del panel (rol "authenticated" + RLS con es_admin()).
-- ---------------------------------------------------------------------------
grant select on public.reservas to authenticated;
grant update (estado) on public.reservas to authenticated;
grant select, insert, delete on public.bloqueos to authenticated;

drop policy if exists admin_lee_reservas on public.reservas;
create policy admin_lee_reservas on public.reservas
  for select to authenticated using (public.es_admin());

drop policy if exists admin_cambia_estado on public.reservas;
create policy admin_cambia_estado on public.reservas
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists admin_lee_bloqueos on public.bloqueos;
create policy admin_lee_bloqueos on public.bloqueos
  for select to authenticated using (public.es_admin());

drop policy if exists admin_crea_bloqueos on public.bloqueos;
create policy admin_crea_bloqueos on public.bloqueos
  for insert to authenticated with check (public.es_admin());

drop policy if exists admin_borra_bloqueos on public.bloqueos;
create policy admin_borra_bloqueos on public.bloqueos
  for delete to authenticated using (public.es_admin());

-- ---------------------------------------------------------------------------
-- Reservas nuevas en vivo en el panel (Supabase Realtime respeta las políticas de arriba).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas'
     ) then
    alter publication supabase_realtime add table public.reservas;
  end if;
end;
$$;
