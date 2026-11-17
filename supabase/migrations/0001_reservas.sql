-- ============================================================================
-- Maick Barber King · Reservas con horarios ocupados
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pega todo este archivo → Run.
-- Solo en una base nueva. Si ya corriste 0002 o los siguientes, este archivo se detiene solo
-- (volver a correrlo borraría los permisos del panel y las reglas nuevas de reserva).
--
-- Seguridad:
--   • Los clientes NO se registran. La página usa la clave pública de Supabase.
--   • Esa clave no puede leer ni modificar las tablas directamente (RLS sin políticas).
--   • La página solo puede llamar dos funciones:
--       horarios_ocupados → devuelve inicio y fin de las horas tomadas, SIN nombres.
--       crear_reserva     → guarda una reserva si la hora sigue libre.
--   • El dueño ve, cancela y bloquea horarios desde el panel de Supabase (Table Editor).
-- ============================================================================

do $$
begin
  if to_regclass('public.administradores') is not null then
    raise exception 'NO VUELVAS A CORRER 0001: esta base ya tiene 0002 o más nuevas. No se cambió nada.';
  end if;
end;
$$;

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------------
create table if not exists public.reservas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  barbero     text not null check (barbero ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  servicio    text not null check (char_length(servicio) between 2 and 80),
  inicio      timestamptz not null,
  fin         timestamptz not null,
  cliente     text not null check (char_length(btrim(cliente)) between 2 and 60),
  nota        text check (nota is null or char_length(nota) <= 200),
  estado      text not null default 'confirmada' check (estado in ('confirmada', 'cancelada')),
  creada_en   timestamptz not null default now(),
  constraint reservas_fin_despues_de_inicio check (fin > inicio),
  -- La garantía principal: un barbero no puede tener dos reservas activas que se crucen.
  -- La base de datos lo impide aunque dos clientes reserven al mismo segundo.
  constraint reservas_sin_cruces exclude using gist (
    barbero with =,
    tstzrange(inicio, fin, '[)') with &&
  ) where (estado = 'confirmada')
);

create index if not exists reservas_barbero_inicio on public.reservas (barbero, inicio);

comment on table public.reservas is
  'Reservas de clientes. Para cancelar una, cambia "estado" a cancelada y la hora vuelve a quedar libre.';

-- ---------------------------------------------------------------------------
-- Bloqueos: almuerzo extra, día libre, vacaciones, cita tomada por teléfono…
-- barbero vacío (NULL) = bloquea a todos los barberos.
-- ---------------------------------------------------------------------------
create table if not exists public.bloqueos (
  id        uuid primary key default gen_random_uuid(),
  barbero   text check (barbero is null or barbero ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  inicio    timestamptz not null,
  fin       timestamptz not null,
  motivo    text,
  creado_en timestamptz not null default now(),
  constraint bloqueos_fin_despues_de_inicio check (fin > inicio)
);

create index if not exists bloqueos_inicio on public.bloqueos (inicio);

comment on table public.bloqueos is
  'Horas en que no se puede reservar. Deja "barbero" vacío para bloquear a todos.';

-- Nadie con la clave pública puede tocar las tablas directamente.
alter table public.reservas enable row level security;
alter table public.bloqueos enable row level security;
revoke all on public.reservas from anon, authenticated;
revoke all on public.bloqueos from anon, authenticated;

-- ---------------------------------------------------------------------------
-- horarios_ocupados: lo que la página necesita para tachar horas. Sin datos de clientes.
-- ---------------------------------------------------------------------------
create or replace function public.horarios_ocupados(p_barbero text, p_desde date, p_hasta date)
returns table (inicio timestamptz, fin timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with rango as (
    select
      (p_desde::timestamp at time zone 'America/La_Paz')     as desde,
      ((p_hasta + 1)::timestamp at time zone 'America/La_Paz') as hasta
    where p_hasta >= p_desde and p_hasta - p_desde <= 62
  )
  select r.inicio, r.fin
  from reservas r, rango
  where r.barbero = p_barbero
    and r.estado = 'confirmada'
    and r.inicio < rango.hasta and r.fin > rango.desde
  union all
  select b.inicio, b.fin
  from bloqueos b, rango
  where (b.barbero is null or b.barbero = p_barbero)
    and b.inicio < rango.hasta and b.fin > rango.desde
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- crear_reserva: guarda la reserva o explica por qué no se pudo.
-- Errores que la página entiende (campo "message"):
--   HORA_OCUPADA, HORA_PASADA, MUY_LEJOS, DATOS_INVALIDOS, DEMASIADAS_RESERVAS
-- ---------------------------------------------------------------------------
create or replace function public.crear_reserva(
  p_barbero      text,
  p_servicio     text,
  p_fecha        date,
  p_hora         time,
  p_duracion_min integer,
  p_cliente      text,
  p_nota         text default null
)
returns table (id uuid, codigo text)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_inicio  timestamptz := (p_fecha + p_hora) at time zone 'America/La_Paz';
  v_fin     timestamptz;
  v_cliente text := btrim(regexp_replace(coalesce(p_cliente, ''), '\s+', ' ', 'g'));
  v_nota    text := nullif(btrim(regexp_replace(coalesce(p_nota, ''), '\s+', ' ', 'g')), '');
begin
  if p_duracion_min is null or p_duracion_min < 5 or p_duracion_min > 300
     or char_length(v_cliente) < 2 or char_length(v_cliente) > 60
     or char_length(coalesce(v_nota, '')) > 200 then
    raise exception 'DATOS_INVALIDOS' using errcode = 'P0001';
  end if;
  v_fin := v_inicio + make_interval(mins => p_duracion_min);

  if v_inicio < now() + interval '10 minutes' then
    raise exception 'HORA_PASADA' using errcode = 'P0001';
  end if;
  if v_inicio > now() + interval '62 days' then
    raise exception 'MUY_LEJOS' using errcode = 'P0001';
  end if;

  -- Freno contra abusos: pocas reservas futuras con el mismo nombre
  -- y un tope de reservas creadas en pocos minutos para toda la página.
  if (select count(*) from reservas r
      where lower(r.cliente) = lower(v_cliente) and r.estado = 'confirmada' and r.inicio > now()) >= 3
     or (select count(*) from reservas r where r.creada_en > now() - interval '10 minutes') >= 30 then
    raise exception 'DEMASIADAS_RESERVAS' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from bloqueos b
    where (b.barbero is null or b.barbero = p_barbero)
      and b.inicio < v_fin and b.fin > v_inicio
  ) then
    raise exception 'HORA_OCUPADA' using errcode = 'P0001';
  end if;

  begin
    return query
      insert into reservas as r (barbero, servicio, inicio, fin, cliente, nota)
      values (p_barbero, p_servicio, v_inicio, v_fin, v_cliente, v_nota)
      returning r.id, r.codigo;
  exception
    when exclusion_violation then
      raise exception 'HORA_OCUPADA' using errcode = 'P0001';
    when check_violation then
      raise exception 'DATOS_INVALIDOS' using errcode = 'P0001';
  end;
end;
$$;

-- Solo estas dos funciones quedan abiertas para la página.
revoke all on function public.horarios_ocupados(text, date, date) from public;
revoke all on function public.crear_reserva(text, text, date, time, integer, text, text) from public;
grant execute on function public.horarios_ocupados(text, date, date) to anon, authenticated;
grant execute on function public.crear_reserva(text, text, date, time, integer, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vista cómoda para el dueño: próximas reservas en hora de Bolivia.
-- (Solo visible en el panel de Supabase, no desde la página.)
-- ---------------------------------------------------------------------------
create or replace view public.agenda
with (security_invoker = true) as
select
  to_char(inicio at time zone 'America/La_Paz', 'YYYY-MM-DD') as fecha,
  to_char(inicio at time zone 'America/La_Paz', 'HH24:MI')    as hora,
  to_char(fin at time zone 'America/La_Paz', 'HH24:MI')       as hasta,
  barbero, servicio, cliente, nota, codigo, estado, id
from public.reservas
where inicio >= date_trunc('day', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz'
order by inicio;

revoke all on public.agenda from anon, authenticated;
