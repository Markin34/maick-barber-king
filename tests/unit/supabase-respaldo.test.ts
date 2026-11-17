/**
 * 0006_respaldo.sql: el rol de la clave secreta (service_role) puede LEER las tablas para el
 * respaldo, pero no escribir ni borrar.
 */
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearBase, errorDe } from './db-prueba';

const leer = (archivo: string) =>
  readFileSync(new URL(`../../supabase/migrations/${archivo}`, import.meta.url), 'utf8');

const TABLAS = [
  'reservas',
  'bloqueos',
  'lista_negra',
  'administradores',
  'catalogo_reglas',
  'catalogo_servicios',
  'catalogo_barbero_servicios',
  'catalogo_horarios',
  'errores_web',
];

let db: PGlite;

beforeAll(async () => {
  db = await crearBase([
    '0001_reservas.sql',
    '0002_admin.sql',
    '0003_cortes_manuales.sql',
    '0004_lista_negra.sql',
    '0005_seguridad.sql',
  ]);
  await db.exec('create role service_role nologin;');
  await db.exec(leer('0006_respaldo.sql'));
  await db.exec(leer('0006_respaldo.sql')); // se puede volver a correr
});

const comoServicio = async <T>(fn: () => Promise<T>) => {
  await db.exec('set role service_role;');
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
};

describe('permiso para respaldos', () => {
  it.each(TABLAS)('service_role puede leer %s', async (tabla) => {
    const r = await comoServicio(() => db.query(`select count(*) from public.${tabla}`));
    expect(r.rows).toHaveLength(1);
  });

  it('service_role no puede borrar ni escribir', async () => {
    expect(await comoServicio(() => errorDe(db.query('delete from public.reservas')))).toMatch(
      /permission denied/,
    );
    expect(
      await comoServicio(() =>
        errorDe(db.query(`insert into public.catalogo_servicios values ('X', 30)`)),
      ),
    ).toMatch(/permission denied/);
  });
});
