-- ============================================================================
-- Maick Barber King · Catálogo para validar reservas
--
-- ⚠️ ARCHIVO GENERADO: no lo edites a mano. Sale de src/data con `npm run catalogo`.
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run.
-- Córrelo después de 0005_seguridad.sql y CADA VEZ que cambies servicios, barberos u horario.
-- Si no lo corres, la base sigue validando con los datos viejos.
-- ============================================================================

begin;

delete from public.catalogo_barbero_servicios;
delete from public.catalogo_horarios;
delete from public.catalogo_servicios;

insert into public.catalogo_reglas
  (id, zona, intervalo_min, ultima_antes_cierre, dias_anticipacion, minutos_minimos)
values
  (true, 'America/La_Paz', 15, 30, 14, 15)
on conflict (id) do update set
  zona = excluded.zona,
  intervalo_min = excluded.intervalo_min,
  ultima_antes_cierre = excluded.ultima_antes_cierre,
  dias_anticipacion = excluded.dias_anticipacion,
  minutos_minimos = excluded.minutos_minimos;

insert into public.catalogo_servicios (nombre, duracion_min) values
  ('Corte normal', 30),
  ('Corte + ceja', 40),
  ('Corte + barba', 45),
  ('Corte + barba + ceja', 60),
  ('Solo barba', 20),
  ('Solo cejas', 15),
  ('Corte desde navaja', 45),
  ('Corte premilitar', 30),
  ('Tinte negro', 45);

insert into public.catalogo_barbero_servicios (barbero, servicio) values
  ('micki', 'Corte normal'),
  ('micki', 'Corte + ceja'),
  ('micki', 'Corte + barba'),
  ('micki', 'Corte + barba + ceja'),
  ('micki', 'Solo barba'),
  ('micki', 'Solo cejas'),
  ('micki', 'Corte desde navaja'),
  ('micki', 'Corte premilitar'),
  ('micki', 'Tinte negro'),
  ('apu', 'Corte normal'),
  ('apu', 'Corte + ceja'),
  ('apu', 'Corte + barba'),
  ('apu', 'Corte + barba + ceja'),
  ('apu', 'Solo barba'),
  ('apu', 'Solo cejas'),
  ('apu', 'Corte desde navaja'),
  ('apu', 'Corte premilitar'),
  ('apu', 'Tinte negro'),
  ('victor', 'Corte normal'),
  ('victor', 'Corte + ceja'),
  ('victor', 'Corte + barba'),
  ('victor', 'Corte + barba + ceja'),
  ('victor', 'Solo barba'),
  ('victor', 'Solo cejas'),
  ('victor', 'Corte desde navaja'),
  ('victor', 'Corte premilitar'),
  ('victor', 'Tinte negro');

-- dia: 0 = domingo, 1 = lunes … 6 = sábado
insert into public.catalogo_horarios (barbero, dia, abre, cierra, descanso_desde, descanso_hasta) values
  ('micki', 1, '08:30', '20:30', '12:00', '14:00'),
  ('micki', 2, '08:30', '20:30', '12:00', '14:00'),
  ('micki', 4, '08:30', '20:30', '12:00', '14:00'),
  ('micki', 5, '08:30', '20:30', '12:00', '14:00'),
  ('micki', 6, '08:30', '20:30', '12:00', '14:00'),
  ('apu', 1, '08:30', '20:30', '12:00', '14:00'),
  ('apu', 3, '08:30', '20:30', '12:00', '14:00'),
  ('apu', 4, '08:30', '20:30', '12:00', '14:00'),
  ('apu', 5, '08:30', '20:30', '12:00', '14:00'),
  ('apu', 6, '08:30', '20:30', '12:00', '14:00'),
  ('victor', 2, '08:30', '20:30', '12:00', '14:00'),
  ('victor', 3, '08:30', '20:30', '12:00', '14:00'),
  ('victor', 4, '08:30', '20:30', '12:00', '14:00'),
  ('victor', 5, '08:30', '20:30', '12:00', '14:00'),
  ('victor', 6, '08:30', '20:30', '12:00', '14:00');

commit;
