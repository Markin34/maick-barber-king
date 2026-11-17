-- ============================================================================
-- Maick Barber King · Permiso de lectura para los respaldos
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run. Se puede volver a correr.
-- Requiere haber corrido antes 0001 a 0005.
--
-- `npm run respaldo` usa la clave secreta (rol service_role) para descargar las tablas.
-- En este proyecto las tablas creadas por SQL no le dan permiso de lectura a ese rol,
-- así que se lo damos aquí: SOLO lectura (select), nada de escribir ni borrar.
-- La página y el panel no usan este rol: esto no cambia nada para los clientes.
-- ============================================================================

grant usage on schema public to service_role;

grant select on
  public.reservas,
  public.bloqueos,
  public.lista_negra,
  public.administradores,
  public.catalogo_reglas,
  public.catalogo_servicios,
  public.catalogo_barbero_servicios,
  public.catalogo_horarios,
  public.errores_web
to service_role;
