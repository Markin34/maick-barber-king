-- ============================================================================
-- Maick Barber King · Vaciar los datos de prueba antes de entregar
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run.
-- ⚠️ BORRA DE VERDAD y no se puede deshacer. Úsalo UNA vez, antes de publicar.
--    Si quieres guardar una copia antes: `npm run respaldo`.
--
-- Borra:   todas las reservas y cortes registrados a mano, la lista negra, los bloqueos
--          de horas, el contador de reservas por conexión y el registro de errores.
-- Deja:    el usuario y la contraseña del panel (administradores), los servicios, precios,
--          barberos y horarios (catalogo_*), y la clave interna de cifrado (secreto_ip).
-- ============================================================================

begin;

delete from public.lista_negra;
delete from public.reservas;
delete from public.bloqueos;
delete from public.limites_ip;
delete from public.errores_web;

commit;

-- Comprobación: todo debe salir en 0, menos administradores y servicios.
select 'reservas y cortes' as tabla, count(*) as filas from public.reservas
union all select 'lista negra', count(*) from public.lista_negra
union all select 'bloqueos', count(*) from public.bloqueos
union all select 'límites por conexión', count(*) from public.limites_ip
union all select 'errores', count(*) from public.errores_web
union all select 'administradores (se queda)', count(*) from public.administradores
union all select 'servicios (se queda)', count(*) from public.catalogo_servicios;
