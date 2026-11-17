-- ============================================================================
-- Maick Barber King · Cortes registrados a mano desde el panel
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run.
-- Requiere haber corrido antes 0001_reservas.sql y 0002_admin.sql. Se puede volver a correr hasta
-- que corras 0005; después se detiene solo (volvería a la crear_reserva sin validaciones).
--
-- Qué agrega:
--   • Columna `origen` en reservas: 'web' (la reservó el cliente) o 'manual' (la anotó el dueño).
--   • Función registrar_corte: el panel anota un corte hecho en el local (cliente sin reserva).
--     Queda como "asistió" y se suma al barbero en Hoy, Agenda y Resumen.
--   • Un corte manual nunca falla por cruzarse con otra cita (a veces se anota tarde o con hora
--     aproximada), pero sí ocupa esa hora: los clientes no pueden reservarla por la página.
-- ============================================================================

do $$
begin
  if to_regclass('public.catalogo_reglas') is not null then
    raise exception 'NO VUELVAS A CORRER 0003: esta base ya tiene 0005. No se cambió nada.';
  end if;
end;
$$;

alter table public.reservas add column if not exists origen text not null default 'web';
alter table public.reservas drop constraint if exists reservas_origen_valido;
alter table public.reservas add constraint reservas_origen_valido
  check (origen in ('web', 'manual'));

-- El candado contra cruces queda solo para reservas de la página.
alter table public.reservas drop constraint if exists reservas_sin_cruces;
alter table public.reservas add constraint reservas_sin_cruces exclude using gist (
  barbero with =,
  tstzrange(inicio, fin, '[)') with &&
) where (estado <> 'cancelada' and origen = 'web');

-- ---------------------------------------------------------------------------
-- crear_reserva: igual que antes, y además respeta los cortes manuales.
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

  if (select count(*) from reservas r
      where lower(r.cliente) = lower(v_cliente) and r.estado = 'confirmada' and r.inicio > now()) >= 3
     or (select count(*) from reservas r where r.creada_en > now() - interval '10 minutes') >= 30 then
    raise exception 'DEMASIADAS_RESERVAS' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from bloqueos b
    where (b.barbero is null or b.barbero = p_barbero)
      and b.inicio < v_fin and b.fin > v_inicio
  ) or exists (
    select 1 from reservas r
    where r.barbero = p_barbero and r.origen = 'manual' and r.estado <> 'cancelada'
      and r.inicio < v_fin and r.fin > v_inicio
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

-- ---------------------------------------------------------------------------
-- registrar_corte: solo para administradores. Errores: SIN_PERMISO, DATOS_INVALIDOS.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_corte(
  p_barbero      text,
  p_servicio     text,
  p_fecha        date,
  p_hora         time,
  p_duracion_min integer,
  p_cliente      text default null
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
  v_cliente text := coalesce(
    nullif(btrim(regexp_replace(coalesce(p_cliente, ''), '\s+', ' ', 'g')), ''),
    'Cliente en local'
  );
begin
  if not public.es_admin() then
    raise exception 'SIN_PERMISO' using errcode = 'P0001';
  end if;
  if p_duracion_min is null or p_duracion_min < 5 or p_duracion_min > 300
     or char_length(v_cliente) < 2 or char_length(v_cliente) > 60
     or v_inicio < now() - interval '62 days' or v_inicio > now() + interval '62 days' then
    raise exception 'DATOS_INVALIDOS' using errcode = 'P0001';
  end if;

  begin
    return query
      insert into reservas as r (barbero, servicio, inicio, fin, cliente, estado, origen)
      values (p_barbero, p_servicio, v_inicio, v_inicio + make_interval(mins => p_duracion_min),
              v_cliente, 'asistio', 'manual')
      returning r.id, r.codigo;
  exception
    when check_violation then
      raise exception 'DATOS_INVALIDOS' using errcode = 'P0001';
  end;
end;
$$;

revoke all on function public.registrar_corte(text, text, date, time, integer, text) from public;
grant execute on function public.registrar_corte(text, text, date, time, integer, text) to authenticated;
