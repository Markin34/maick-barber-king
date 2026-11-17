-- ============================================================================
-- Maick Barber King · Seguridad de las reservas
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run. Se puede volver a correr.
-- Requiere haber corrido antes 0001, 0002, 0003 y 0004.
-- DESPUÉS de este archivo, corre también supabase/catalogo.sql (servicios, barberos y horario).
--
-- Qué agrega:
--   • La base de datos conoce los servicios, qué barbero hace cada uno y el horario de atención
--     (tablas catalogo_*, que llena catalogo.sql). crear_reserva ya no confía en la página:
--       - la duración sale del servicio guardado, no de lo que mande el navegador;
--       - el servicio tiene que existir y el barbero tiene que hacerlo;
--       - la hora tiene que caer dentro del horario, en el intervalo de la página y fuera del descanso;
--       - respeta los días de anticipación y los minutos mínimos de negocio.ts.
--   • Límite por conexión (IP): pocas reservas por hora y por día desde el mismo lugar.
--     La IP no se guarda tal cual: se guarda cifrada (hash con una clave propia de esta base).
--   • cancelar_reserva: el cliente cancela su propia cita con el código y su nombre.
--   • registrar_error: la página anota errores inesperados en la tabla errores_web.
--
-- Errores nuevos que la página entiende: FUERA_DE_HORARIO, SIN_CATALOGO.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo (lo llena supabase/catalogo.sql, generado desde src/data con `npm run catalogo`)
-- ---------------------------------------------------------------------------
create table if not exists public.catalogo_reglas (
  id                  boolean primary key default true check (id),
  zona                text not null,
  intervalo_min       integer not null check (intervalo_min in (15, 20, 30, 60)),
  ultima_antes_cierre integer not null check (ultima_antes_cierre between 0 and 240),
  dias_anticipacion   integer not null check (dias_anticipacion between 1 and 60),
  minutos_minimos     integer not null check (minutos_minimos between 0 and 1440),
  -- Hasta cuántos minutos antes de la cita el cliente puede cancelarla él mismo.
  minutos_cancelacion integer not null default 60 check (minutos_cancelacion between 0 and 1440)
);

create table if not exists public.catalogo_servicios (
  nombre       text primary key,
  duracion_min integer not null check (duracion_min between 5 and 300)
);

-- Qué servicios hace cada barbero. Un barbero que no aparece aquí no recibe reservas.
create table if not exists public.catalogo_barbero_servicios (
  barbero  text not null check (barbero ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  servicio text not null references public.catalogo_servicios (nombre) on delete cascade,
  primary key (barbero, servicio)
);

-- Horario de cada barbero por día (0 = domingo … 6 = sábado). Día sin fila = no trabaja.
create table if not exists public.catalogo_horarios (
  barbero        text not null,
  dia            smallint not null check (dia between 0 and 6),
  abre           time not null,
  cierra         time not null,
  descanso_desde time,
  descanso_hasta time,
  primary key (barbero, dia),
  check (cierra > abre),
  check ((descanso_desde is null) = (descanso_hasta is null)),
  check (descanso_hasta is null or descanso_hasta > descanso_desde)
);

comment on table public.catalogo_servicios is
  'Copia de src/data/servicios.ts. No la edites a mano: corre `npm run catalogo` y pega supabase/catalogo.sql.';

-- ---------------------------------------------------------------------------
-- Límites por conexión
-- ---------------------------------------------------------------------------
create table if not exists public.limites_ip (
  id        bigint generated always as identity primary key,
  accion    text not null,
  ip_hash   text not null,
  creado_en timestamptz not null default now()
);
create index if not exists limites_ip_buscar on public.limites_ip (accion, ip_hash, creado_en);

-- Clave para cifrar las IP. Se crea sola una vez y nadie la ve desde la página.
create table if not exists public.secreto_ip (
  id  boolean primary key default true check (id),
  sal text not null
);
insert into public.secreto_ip (sal) values (md5(gen_random_uuid()::text || clock_timestamp()::text))
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Errores de la página (para enterarse si algo falla a los clientes)
-- ---------------------------------------------------------------------------
create table if not exists public.errores_web (
  id        bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  pagina    text,
  mensaje   text not null,
  detalle   text,
  navegador text
);
create index if not exists errores_web_creado on public.errores_web (creado_en desc);
comment on table public.errores_web is
  'Errores inesperados que vieron los clientes en la página. Se borran solos a los 30 días.';

alter table public.catalogo_reglas enable row level security;
alter table public.catalogo_servicios enable row level security;
alter table public.catalogo_barbero_servicios enable row level security;
alter table public.catalogo_horarios enable row level security;
alter table public.limites_ip enable row level security;
alter table public.secreto_ip enable row level security;
alter table public.errores_web enable row level security;
revoke all on public.catalogo_reglas, public.catalogo_servicios, public.catalogo_barbero_servicios,
  public.catalogo_horarios, public.limites_ip, public.secreto_ip, public.errores_web
  from anon, authenticated;

-- El panel puede leer los errores (solo administradores).
grant select on public.errores_web to authenticated;
drop policy if exists admin_lee_errores on public.errores_web;
create policy admin_lee_errores on public.errores_web
  for select to authenticated using (public.es_admin());

-- ---------------------------------------------------------------------------
-- IP del cliente, cifrada. NULL si la llamada no viene por la API (por ejemplo, el SQL Editor).
-- Supabase pasa por Cloudflare: cf-connecting-ip la pone Cloudflare y el cliente no la puede falsear.
-- ---------------------------------------------------------------------------
create or replace function public.ip_cliente_hash()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers json;
  v_ip      text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := btrim(coalesce(
    v_headers ->> 'cf-connecting-ip',
    v_headers ->> 'x-real-ip',
    split_part(v_headers ->> 'x-forwarded-for', ',', 1)
  ));
  if v_ip is null or v_ip = '' then
    return null;
  end if;
  return md5((select sal from secreto_ip) || v_ip);
end;
$$;
revoke all on function public.ip_cliente_hash() from public;

-- ---------------------------------------------------------------------------
-- crear_reserva: misma firma que antes (la página publicada sigue funcionando),
-- pero ahora valida todo contra el catálogo. p_duracion_min se ignora.
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
  v_reglas  catalogo_reglas;
  v_horario catalogo_horarios;
  v_dur     integer;
  v_inicio  timestamptz;
  v_fin     timestamptz;
  v_min     integer;
  v_abre    integer;
  v_ultima  integer;
  v_hoy     date;
  v_ip      text := public.ip_cliente_hash();
  v_cliente text := btrim(regexp_replace(coalesce(p_cliente, ''), '\s+', ' ', 'g'));
  v_nota    text := nullif(btrim(regexp_replace(coalesce(p_nota, ''), '\s+', ' ', 'g')), '');
begin
  select * into v_reglas from catalogo_reglas;
  if not found then
    raise exception 'SIN_CATALOGO' using errcode = 'P0001';
  end if;

  if p_fecha is null or p_hora is null
     or char_length(v_cliente) < 2 or char_length(v_cliente) > 60
     or char_length(coalesce(v_nota, '')) > 200 then
    raise exception 'DATOS_INVALIDOS' using errcode = 'P0001';
  end if;

  -- El servicio existe y este barbero lo hace. La duración es la del catálogo.
  select s.duracion_min into v_dur
  from catalogo_servicios s
  join catalogo_barbero_servicios bs on bs.servicio = s.nombre and bs.barbero = p_barbero
  where s.nombre = p_servicio;
  if v_dur is null then
    raise exception 'DATOS_INVALIDOS' using errcode = 'P0001';
  end if;

  v_inicio := (p_fecha + p_hora) at time zone v_reglas.zona;
  v_fin := v_inicio + make_interval(mins => v_dur);
  v_hoy := (now() at time zone v_reglas.zona)::date;

  -- 5 minutos de tolerancia: el cliente pudo tardar en escribir su nombre.
  if v_inicio < now() + make_interval(mins => greatest(v_reglas.minutos_minimos - 5, 0)) then
    raise exception 'HORA_PASADA' using errcode = 'P0001';
  end if;
  if p_fecha > v_hoy + (v_reglas.dias_anticipacion - 1) then
    raise exception 'MUY_LEJOS' using errcode = 'P0001';
  end if;

  -- Dentro del horario de ese barbero, en el intervalo de la página y fuera del descanso.
  select * into v_horario from catalogo_horarios h
  where h.barbero = p_barbero and h.dia = extract(dow from p_fecha)::smallint;
  if not found then
    raise exception 'FUERA_DE_HORARIO' using errcode = 'P0001';
  end if;
  v_min := extract(hour from p_hora)::int * 60 + extract(minute from p_hora)::int;
  v_abre := extract(hour from v_horario.abre)::int * 60 + extract(minute from v_horario.abre)::int;
  v_ultima := extract(hour from v_horario.cierra)::int * 60 + extract(minute from v_horario.cierra)::int
              - v_reglas.ultima_antes_cierre;
  if extract(second from p_hora) <> 0
     or v_min < v_abre or v_min > v_ultima
     or (v_min - v_abre) % v_reglas.intervalo_min <> 0
     or (v_horario.descanso_desde is not null
         and p_hora < v_horario.descanso_hasta
         and p_hora + make_interval(mins => v_dur) > v_horario.descanso_desde) then
    raise exception 'FUERA_DE_HORARIO' using errcode = 'P0001';
  end if;

  -- Frenos contra abusos:
  --   • 3 reservas futuras con el mismo nombre;
  --   • 4 por hora y 8 por día desde la misma conexión;
  --   • 60 reservas en 10 minutos para toda la página (tope de emergencia).
  if (select count(*) from reservas r
      where lower(r.cliente) = lower(v_cliente) and r.estado = 'confirmada' and r.inicio > now()) >= 3
     or (v_ip is not null and (
           (select count(*) from limites_ip l
            where l.accion = 'reservar' and l.ip_hash = v_ip and l.creado_en > now() - interval '1 hour') >= 4
        or (select count(*) from limites_ip l
            where l.accion = 'reservar' and l.ip_hash = v_ip and l.creado_en > now() - interval '1 day') >= 8))
     or (select count(*) from reservas r
         where r.origen = 'web' and r.creada_en > now() - interval '10 minutes') >= 60 then
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

  delete from limites_ip l where l.creado_en < now() - interval '2 days';
  if v_ip is not null then
    insert into limites_ip (accion, ip_hash) values ('reservar', v_ip);
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

revoke all on function public.crear_reserva(text, text, date, time, integer, text, text) from public;
grant execute on function public.crear_reserva(text, text, date, time, integer, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- cancelar_reserva: el cliente cancela con su código y el nombre con que reservó.
-- Devuelve (no lanza error, así los intentos fallidos quedan contados):
--   CANCELADA, NO_ENCONTRADA, MUY_TARDE, DEMASIADOS_INTENTOS
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_reserva(p_codigo text, p_cliente text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ip      text := public.ip_cliente_hash();
  v_codigo  text := upper(btrim(coalesce(p_codigo, '')));
  v_cliente text := lower(btrim(regexp_replace(coalesce(p_cliente, ''), '\s+', ' ', 'g')));
  v_reserva reservas;
  v_minutos integer := coalesce((select minutos_cancelacion from catalogo_reglas), 60);
begin
  -- 10 intentos por hora desde la misma conexión: adivinar códigos no sirve.
  if v_ip is not null then
    if (select count(*) from limites_ip l
        where l.accion = 'cancelar' and l.ip_hash = v_ip and l.creado_en > now() - interval '1 hour') >= 10 then
      return 'DEMASIADOS_INTENTOS';
    end if;
    insert into limites_ip (accion, ip_hash) values ('cancelar', v_ip);
  end if;

  if v_codigo !~ '^[0-9A-F]{6}$' or char_length(v_cliente) < 2 then
    return 'NO_ENCONTRADA';
  end if;

  select * into v_reserva from reservas r
  where r.codigo = v_codigo
    and r.origen = 'web'
    and r.estado = 'confirmada'
    and r.inicio > now()
    and lower(btrim(regexp_replace(r.cliente, '\s+', ' ', 'g'))) = v_cliente
  order by r.inicio
  limit 1;
  if not found then
    return 'NO_ENCONTRADA';
  end if;

  if v_reserva.inicio < now() + make_interval(mins => v_minutos) then
    return 'MUY_TARDE';
  end if;

  -- El aviso en vivo del panel y la lista negra se enteran solos (trigger de 0004).
  perform set_config('mbk.cancelada_por', 'cliente', true);
  update reservas set estado = 'cancelada' where reservas.id = v_reserva.id;
  return 'CANCELADA';
end;
$$;
revoke all on function public.cancelar_reserva(text, text) from public;
grant execute on function public.cancelar_reserva(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lista negra: si canceló el propio cliente desde la página, el motivo lo dice.
-- ---------------------------------------------------------------------------
create or replace function public.lista_negra_por_cancelacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'cancelada' and old.estado is distinct from 'cancelada' and new.origen = 'web' then
    insert into lista_negra (reserva_id, cliente, barbero, servicio, cita_inicio, motivo)
    values (
      new.id, new.cliente, new.barbero, new.servicio, new.inicio,
      case when current_setting('mbk.cancelada_por', true) = 'cliente'
           then 'Canceló desde la página' else 'Canceló su cita' end
    )
    on conflict (reserva_id) do nothing;
  elsif old.estado = 'cancelada' and new.estado <> 'cancelada' then
    delete from lista_negra where reserva_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.lista_negra_por_cancelacion() from public;

-- ---------------------------------------------------------------------------
-- registrar_error: la página anota un error. Nunca falla (si se pasa de los topes, lo ignora).
-- ---------------------------------------------------------------------------
create or replace function public.registrar_error(
  p_mensaje text,
  p_pagina  text default null,
  p_detalle text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ip      text := public.ip_cliente_hash();
  v_headers json;
begin
  if p_mensaje is null or btrim(p_mensaje) = '' then
    return;
  end if;
  -- Topes: 20 por hora por conexión y 300 por hora en total.
  if (v_ip is not null and (select count(*) from limites_ip l
        where l.accion = 'error' and l.ip_hash = v_ip and l.creado_en > now() - interval '1 hour') >= 20)
     or (select count(*) from errores_web e where e.creado_en > now() - interval '1 hour') >= 300 then
    return;
  end if;
  if v_ip is not null then
    insert into limites_ip (accion, ip_hash) values ('error', v_ip);
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;

  delete from errores_web e where e.creado_en < now() - interval '30 days';
  insert into errores_web (pagina, mensaje, detalle, navegador)
  values (
    left(p_pagina, 200),
    left(p_mensaje, 300),
    left(p_detalle, 2000),
    left(v_headers ->> 'user-agent', 300)
  );
end;
$$;
revoke all on function public.registrar_error(text, text, text) from public;
grant execute on function public.registrar_error(text, text, text) to anon, authenticated;
