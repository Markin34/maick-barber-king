/**
 * 0007_borrar_citas.sql: solo el administrador puede eliminar una cita, y al hacerlo
 * también sale de la lista negra.
 */
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { como, crearBase, errorDe } from './db-prueba';

const leer = (archivo: string) =>
  readFileSync(new URL(`../../supabase/migrations/${archivo}`, import.meta.url), 'utf8');

const DUENO = '11111111-1111-1111-1111-111111111111';
const CURIOSO = '22222222-2222-2222-2222-222222222222';

let db: PGlite;

let siguiente = 0;
const crearCita = async (cliente: string) => {
  // Cada cita en su propia hora: la base no deja dos citas cruzadas del mismo barbero.
  siguiente += 1;
  const r = await db.query<{ id: string }>(
    `insert into reservas (barbero, servicio, inicio, fin, cliente)
     values ('apu', 'Corte normal', now() + make_interval(days => 2, hours => $2::int),
             now() + make_interval(days => 2, hours => $2::int, mins => 30), $1)
     returning id`,
    [cliente, siguiente],
  );
  return r.rows[0]!.id;
};

const existe = async (id: string) =>
  (await db.query('select 1 from reservas where id = $1', [id])).rows.length === 1;

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
  await db.exec(leer('0007_borrar_citas.sql'));
  await db.exec(leer('0007_borrar_citas.sql')); // se puede volver a correr
  await db.exec(`
    insert into auth.users (id, email) values
      ('${DUENO}', 'dueno@ejemplo.com'), ('${CURIOSO}', 'curioso@ejemplo.com');
    insert into administradores (user_id, nombre) values ('${DUENO}', 'Dueño');
  `);
});

describe('eliminar citas', () => {
  it('el dueño elimina una cita y desaparece por completo', async () => {
    const id = await crearCita('Carlos');
    const r = await como(db, DUENO, () =>
      db.query('delete from reservas where id = $1 returning id', [id]),
    );
    expect(r.rows).toHaveLength(1);
    expect(await existe(id)).toBe(false);
  });

  it('al eliminar una cita cancelada, también sale de la lista negra', async () => {
    const id = await crearCita('Ana');
    await db.query(`update reservas set estado = 'cancelada' where id = $1`, [id]);
    const enLista = () => db.query('select 1 from lista_negra where reserva_id = $1', [id]);
    expect((await enLista()).rows).toHaveLength(1);

    await como(db, DUENO, () => db.query('delete from reservas where id = $1', [id]));
    expect((await enLista()).rows).toHaveLength(0);
  });

  it('alguien con sesión que no es administrador no borra nada', async () => {
    const id = await crearCita('Luis');
    const r = await como(db, CURIOSO, () =>
      db.query('delete from reservas where id = $1 returning id', [id]),
    );
    expect(r.rows).toHaveLength(0);
    expect(await existe(id)).toBe(true);
  });

  it('los clientes (clave pública) no pueden borrar', async () => {
    const id = await crearCita('Pedro');
    expect(
      await como(db, null, () => errorDe(db.query('delete from reservas where id = $1', [id]))),
    ).toMatch(/permission denied/);
    expect(await existe(id)).toBe(true);
  });
});
