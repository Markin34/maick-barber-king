/**
 * supabase/vaciar-datos-de-prueba.sql: borra reservas, cortes, lista negra, bloqueos y errores,
 * pero deja el catálogo y los administradores, y la página sigue aceptando reservas.
 */
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogo } from '../../src/data';
import { catalogoSql } from '../../src/lib/catalogo-sql';
import { ahoraEn, diaDeSemana, sumarDias } from '../../src/lib/tiempo';
import { como, crearBase } from './db-prueba';

const leer = (ruta: string) => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8');
const ADMIN = '22222222-2222-2222-2222-222222222222';

const hoy = ahoraEn('America/La_Paz').fecha;
const jueves = (() => {
  for (let i = 1; ; i++) if (diaDeSemana(sumarDias(hoy, i)) === 4) return sumarDias(hoy, i);
})();

let db: PGlite;

const reservar = (hora: string, cliente: string) =>
  como(db, null, () =>
    db.query<{ id: string }>(
      `select * from crear_reserva('micki', 'Corte normal', $1::date, $2::time, 30, $3, null)`,
      [jueves, hora, cliente],
    ),
  );
const contar = async (tabla: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from public.${tabla}`)).rows[0]!.n;

beforeAll(async () => {
  db = await crearBase([
    '0001_reservas.sql',
    '0002_admin.sql',
    '0003_cortes_manuales.sql',
    '0004_lista_negra.sql',
    '0005_seguridad.sql',
  ]);
  await db.exec(catalogoSql(catalogo));
  await db.query(`insert into auth.users values ($1, 'admin@maickbarberking.com')`, [ADMIN]);
  await db.query(`insert into administradores (user_id) values ($1)`, [ADMIN]);

  // Datos de prueba: reservas, una cancelada (entra a la lista negra), un corte manual y un bloqueo.
  const r = await reservar('10:00', 'Prueba Uno');
  await reservar('11:00', 'Prueba Dos');
  await db.query(`update reservas set estado = 'cancelada' where id = $1`, [r.rows[0]!.id]);
  await como(db, ADMIN, () =>
    db.query(
      `select registrar_corte('apu', 'Corte normal', $1::date, '15:00'::time, 30, 'Sin reserva')`,
      [jueves],
    ),
  );
  await db.query(
    `insert into bloqueos (barbero, inicio, fin, motivo)
     values (null, $1::date + time '16:00', $1::date + time '17:00', 'Prueba')`,
    [jueves],
  );
});

describe('vaciar datos de prueba', () => {
  it('había datos de prueba antes de vaciar', async () => {
    expect(await contar('reservas')).toBe(3);
    expect(await contar('lista_negra')).toBe(1);
    expect(await contar('bloqueos')).toBe(1);
  });

  it('borra reservas, cortes, lista negra y bloqueos; deja catálogo y administradores', async () => {
    await db.exec(leer('supabase/vaciar-datos-de-prueba.sql'));
    for (const tabla of ['reservas', 'lista_negra', 'bloqueos', 'limites_ip', 'errores_web']) {
      expect(await contar(tabla), tabla).toBe(0);
    }
    expect(await contar('administradores')).toBe(1);
    expect(await contar('catalogo_servicios')).toBe(catalogo.servicios.length);
    expect(await contar('catalogo_horarios')).toBeGreaterThan(0);
  });

  it('después de vaciar, la página sigue aceptando reservas', async () => {
    const r = await reservar('10:00', 'Primer Cliente Real');
    expect(r.rows).toHaveLength(1);
  });
});
