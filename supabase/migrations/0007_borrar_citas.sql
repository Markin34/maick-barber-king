-- ============================================================================
-- Maick Barber King · El dueño puede eliminar citas por completo
--
-- Cómo usarlo: Supabase → SQL Editor → pega todo este archivo → Run. Se puede volver a correr.
-- Requiere haber corrido antes 0001 a 0006.
--
-- Qué hace:
--   • Desde el panel, el administrador puede borrar una cita (web o anotada a mano).
--     Se borra de verdad: no queda en la agenda, ni en el resumen, ni en la lista negra
--     (la fila de la lista negra que vino de esa cita se va sola: "on delete cascade" de 0004).
--   • Solo los administradores (es_admin()). La clave pública y otros usuarios no pueden.
--   • Para "cancelar" (que el cliente quede registrado) se sigue usando el estado "cancelada".
-- ============================================================================

grant delete on public.reservas to authenticated;

drop policy if exists admin_borra_reservas on public.reservas;
create policy admin_borra_reservas on public.reservas
  for delete to authenticated using (public.es_admin());
