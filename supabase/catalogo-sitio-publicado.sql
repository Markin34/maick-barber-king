-- ============================================================================
-- Maick Barber King · Servicios de la página PUBLICADA (versión vieja)
--
-- Por qué existe: la página que hoy está en Vercel todavía ofrece los servicios viejos
-- ("Corte clásico", "Fade / degradado", ...). catalogo.sql solo carga los nuevos, así que la base
-- rechazaba esas reservas. Esto agrega los viejos para que la página publicada siga funcionando.
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo → Run. Se puede volver a correr.
-- Cuando despliegues la página nueva, vuelve a correr catalogo.sql: borra estos y deja solo los nuevos.
-- ============================================================================

insert into public.catalogo_servicios (nombre, duracion_min) values
  ('Corte clásico', 30),
  ('Fade / degradado', 45),
  ('Corte + barba', 60),
  ('Perfilado de barba', 30),
  ('Cejas', 15),
  ('Corte niño', 30)
on conflict (nombre) do nothing;

insert into public.catalogo_barbero_servicios (barbero, servicio)
select b.barbero, s.servicio
from (values ('micki'), ('apu'), ('victor')) as b (barbero)
cross join (values
  ('Corte clásico'), ('Fade / degradado'), ('Corte + barba'),
  ('Perfilado de barba'), ('Cejas'), ('Corte niño')
) as s (servicio)
on conflict do nothing;
