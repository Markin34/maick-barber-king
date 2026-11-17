-- ============================================================================
-- Maick Barber King · Lista negra
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run.
-- Requiere haber corrido antes 0001, 0002 y 0003. Se puede volver a correr hasta que corras 0005;
-- después se detiene solo (0005 mejora el aviso de la lista negra).
--
-- Qué hace:
--   • Cuando una reserva de la página pasa a "cancelada", el cliente entra solo a la lista negra.
--     (Los cortes anotados a mano que se quitan NO entran.)
--   • Si la cita vuelve a "confirmada", "asistió" o "no vino", se saca de la lista (fue un error).
--   • El barbero o el dueño escribe la penitencia. Es solo una anotación: no impide reservar.
--   • Solo los administradores ven y cambian la lista. La clave pública no puede leerla.
-- ============================================================================

do $$
begin
  if to_regclass('public.catalogo_reglas') is not null then
    raise exception 'NO VUELVAS A CORRER 0004: esta base ya tiene 0005. No se cambió nada.';
  end if;
end;
$$;

create table if not exists public.lista_negra (
  id          uuid primary key default gen_random_uuid(),
  -- Reserva que la originó. Vacío si el dueño agregó al cliente a mano.
  reserva_id  uuid unique references public.reservas (id) on delete cascade,
  cliente     text not null check (char_length(btrim(cliente)) between 2 and 60),
  barbero     text,
  servicio    text,
  cita_inicio timestamptz,
  motivo      text not null default 'Canceló su cita' check (char_length(motivo) between 2 and 120),
  penitencia  text check (penitencia is null or char_length(penitencia) <= 200),
  creado_en   timestamptz not null default now()
);

create index if not exists lista_negra_creado on public.lista_negra (creado_en desc);

comment on table public.lista_negra is
  'Clientes que cancelaron una cita. La penitencia la decide el barbero; es solo una anotación.';

alter table public.lista_negra enable row level security;
revoke all on public.lista_negra from anon, authenticated;
grant select, insert, delete on public.lista_negra to authenticated;
grant update (motivo, penitencia) on public.lista_negra to authenticated;

drop policy if exists admin_lee_lista_negra on public.lista_negra;
create policy admin_lee_lista_negra on public.lista_negra
  for select to authenticated using (public.es_admin());

drop policy if exists admin_agrega_lista_negra on public.lista_negra;
create policy admin_agrega_lista_negra on public.lista_negra
  for insert to authenticated with check (public.es_admin());

drop policy if exists admin_cambia_lista_negra on public.lista_negra;
create policy admin_cambia_lista_negra on public.lista_negra
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists admin_quita_lista_negra on public.lista_negra;
create policy admin_quita_lista_negra on public.lista_negra
  for delete to authenticated using (public.es_admin());

-- ---------------------------------------------------------------------------
-- Al cancelar una reserva de la página, el cliente entra a la lista. Al deshacer, sale.
-- ---------------------------------------------------------------------------
create or replace function public.lista_negra_por_cancelacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'cancelada' and old.estado is distinct from 'cancelada' and new.origen = 'web' then
    insert into lista_negra (reserva_id, cliente, barbero, servicio, cita_inicio)
    values (new.id, new.cliente, new.barbero, new.servicio, new.inicio)
    on conflict (reserva_id) do nothing;
  elsif old.estado = 'cancelada' and new.estado <> 'cancelada' then
    delete from lista_negra where reserva_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.lista_negra_por_cancelacion() from public;

drop trigger if exists reservas_lista_negra on public.reservas;
create trigger reservas_lista_negra
  after update of estado on public.reservas
  for each row execute function public.lista_negra_por_cancelacion();
