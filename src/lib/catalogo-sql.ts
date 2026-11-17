/**
 * Arma supabase/catalogo.sql a partir de src/data: servicios, qué barbero hace cada uno, horario
 * y reglas de reserva. Así la base de datos valida las reservas con los mismos datos de la página.
 *
 * El archivo se genera con `npm run catalogo`. Una prueba revisa que esté al día: si cambias
 * src/data y te olvidas de regenerarlo, `npm test` (y el build) fallan avisando.
 */
import type { Catalogo } from '../data';
import { serviciosDe } from '../data';
import { DIAS } from '../data/dias';
import { horarioDelDia } from './horarios';

/** Texto como literal de SQL: 'O''Brien'. */
const texto = (t: string) => `'${t.replace(/'/g, "''")}'`;
const horaSql = (h: string | undefined) => (h ? `'${h}'` : 'null');

/** Una fecha cualquiera que cae en cada día de la semana (2024-01-07 fue domingo). */
const FECHA_DEL_DIA = DIAS.map((_, i) => `2024-01-${String(7 + i).padStart(2, '0')}`);

export function catalogoSql(c: Pick<Catalogo, 'negocio' | 'barberos' | 'servicios'>): string {
  const { negocio, barberos, servicios } = c;

  const filasServicios = servicios.map((s) => `  (${texto(s.nombre)}, ${s.duracionMin})`);

  const filasBarberoServicios = barberos.flatMap((b) =>
    serviciosDe(b, servicios).map((s) => `  (${texto(b.id)}, ${texto(s.nombre)})`),
  );

  const filasHorarios = barberos.flatMap((b) =>
    DIAS.flatMap((_, dia) => {
      const h = horarioDelDia(negocio, b, FECHA_DEL_DIA[dia] ?? '');
      if (!h) return [];
      return [
        `  (${texto(b.id)}, ${dia}, '${h.abre}', '${h.cierra}', ${horaSql(h.descanso?.desde)}, ${horaSql(h.descanso?.hasta)})`,
      ];
    }),
  );

  return `-- ============================================================================
-- Maick Barber King · Catálogo para validar reservas
--
-- ⚠️ ARCHIVO GENERADO: no lo edites a mano. Sale de src/data con \`npm run catalogo\`.
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
  (true, ${texto(negocio.zonaHoraria)}, ${negocio.intervaloMin}, ${negocio.ultimaReservaAntesDelCierre}, ${negocio.diasAnticipacion}, ${negocio.minutosMinimos})
on conflict (id) do update set
  zona = excluded.zona,
  intervalo_min = excluded.intervalo_min,
  ultima_antes_cierre = excluded.ultima_antes_cierre,
  dias_anticipacion = excluded.dias_anticipacion,
  minutos_minimos = excluded.minutos_minimos;

insert into public.catalogo_servicios (nombre, duracion_min) values
${filasServicios.join(',\n')};

insert into public.catalogo_barbero_servicios (barbero, servicio) values
${filasBarberoServicios.join(',\n')};

-- dia: 0 = domingo, 1 = lunes … 6 = sábado
insert into public.catalogo_horarios (barbero, dia, abre, cierra, descanso_desde, descanso_hasta) values
${filasHorarios.join(',\n')};

commit;
`;
}
