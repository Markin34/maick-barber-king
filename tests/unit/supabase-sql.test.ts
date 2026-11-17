/**
 * Corre la migración real en un Postgres en memoria (PGlite) y prueba las reglas de la base de datos.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { ahoraEn, sumarDias } from '../../src/lib/tiempo';

const leer = (archivo: string) =>
  readFileSync(new URL(`../../supabase/migrations/${archivo}`, import.meta.url), 'utf8');
const migracion = leer('0001_reservas.sql');
const migracionAdmin = leer('0002_admin.sql');
const migracionCortes = leer('0003_cortes_manuales.sql');
const migracionListaNegra = leer('0004_lista_negra.sql');
const dia = sumarDias(ahoraEn('America/La_Paz').fecha, 3);

let db: PGlite;

async function reservar(
  hora: string,
  opciones: { barbero?: string; duracion?: number; cliente?: string } = {},
) {
  const { barbero = 'apu', duracion = 30, cliente = 'Carlos Pérez' } = opciones;
  const r = await db.query<{ id: string; codigo: string }>(
    'select * from crear_reserva($1, $2, $3::date, $4::time, $5, $6, $7)',
    [barbero, 'Corte clásico', dia, hora, duracion, cliente, null],
  );
  return r.rows[0];
}

async function errorDe(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
    return 'SIN_ERROR';
  } catch (e) {
    return (e as Error).message;
  }
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { btree_gist } });
  // En Supabase estos roles ya existen.
  await db.exec(`create role anon nologin; create role authenticated nologin;`);
  await db.exec(migracion);
  // Se puede correr dos veces sin errores.
  await db.exec(migracion);
});

describe('base de datos de reservas', () => {
  it('guarda una reserva y devuelve un código corto', async () => {
    const r = await reservar('10:00');
    expect(r?.codigo).toMatch(/^[0-9A-F]{6}$/);
  });

  it('no deja reservar una hora que se cruza con otra del mismo barbero', async () => {
    expect(await errorDe(reservar('10:15', { cliente: 'Otro Cliente' }))).toBe('HORA_OCUPADA');
  });

  it('permite una reserva justo cuando termina la anterior, y otro barbero a la misma hora', async () => {
    await expect(reservar('10:30', { cliente: 'Luis' })).resolves.toBeDefined();
    await expect(reservar('10:00', { barbero: 'micki', cliente: 'Ana' })).resolves.toBeDefined();
  });

  it('al cancelar, la hora vuelve a quedar libre', async () => {
    await db.exec(
      `update reservas set estado = 'cancelada' where barbero = 'apu' and cliente = 'Luis'`,
    );
    await expect(reservar('10:30', { cliente: 'Pedro' })).resolves.toBeDefined();
  });

  it('respeta los bloqueos del dueño', async () => {
    await db.query(
      `insert into bloqueos (barbero, inicio, fin, motivo)
       values (null, ($1::date + time '13:00') at time zone 'America/La_Paz',
                     ($1::date + time '14:00') at time zone 'America/La_Paz', 'Almuerzo')`,
      [dia],
    );
    expect(await errorDe(reservar('13:30', { cliente: 'Mario' }))).toBe('HORA_OCUPADA');
  });

  it('horarios_ocupados devuelve solo inicio y fin, sin datos de clientes', async () => {
    const r = await db.query<Record<string, unknown>>(
      'select * from horarios_ocupados($1, $2::date, $2::date)',
      ['apu', dia],
    );
    expect(Object.keys(r.rows[0] ?? {})).toEqual(['inicio', 'fin']);
    // 10:00, 10:30 (Pedro) y el bloqueo de 13:00
    expect(r.rows).toHaveLength(3);
  });

  it('rechaza horas pasadas, datos inválidos y abusos', async () => {
    const ayer = sumarDias(ahoraEn('America/La_Paz').fecha, -1);
    expect(
      await errorDe(
        db.query(`select * from crear_reserva('apu','Corte',$1::date,'10:00',30,'Juan',null)`, [
          ayer,
        ]),
      ),
    ).toBe('HORA_PASADA');
    expect(await errorDe(reservar('16:00', { cliente: ' ' }))).toBe('DATOS_INVALIDOS');
    expect(await errorDe(reservar('16:00', { duracion: 999, cliente: 'Juan' }))).toBe(
      'DATOS_INVALIDOS',
    );

    await reservar('17:00', { cliente: 'Repetido' });
    await reservar('17:30', { cliente: 'repetido' });
    await reservar('18:00', { cliente: 'REPETIDO' });
    expect(await errorDe(reservar('18:30', { cliente: 'Repetido' }))).toBe('DEMASIADAS_RESERVAS');
  });

  it('la clave pública no puede leer ni escribir las tablas directamente', async () => {
    await db.exec('set role anon');
    try {
      expect(await errorDe(db.query('select * from reservas'))).toMatch(/permission denied/);
      expect(await errorDe(db.query(`delete from reservas`))).toMatch(/permission denied/);
      expect(await errorDe(db.query('select * from agenda'))).toMatch(/permission denied/);
      // Pero sí puede usar las funciones públicas.
      await expect(
        db.query('select * from horarios_ocupados($1, $2::date, $2::date)', ['apu', dia]),
      ).resolves.toBeDefined();
    } finally {
      await db.exec('reset role');
    }
  });
});

describe('cortes anotados a mano (0003)', () => {
  const ADMIN = '11111111-1111-1111-1111-111111111111';
  const corte = (hora: string, fecha = dia, barbero = 'micki') =>
    db.query<{ id: string }>(
      `select * from registrar_corte($1, 'Corte normal', $2::date, $3::time, 30, null)`,
      [barbero, fecha, hora],
    );

  beforeAll(async () => {
    // Lo mínimo de Supabase Auth que usan las migraciones del panel.
    await db.exec(`
      create schema if not exists auth;
      create table if not exists auth.users (id uuid primary key);
      create or replace function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
      insert into auth.users values ('${ADMIN}') on conflict do nothing;
    `);
    await db.exec(migracionAdmin);
    await db.exec(migracionCortes);
    await db.exec(migracionCortes);
    await db.exec(`insert into administradores (user_id) values ('${ADMIN}')`);
  });

  it('solo un administrador puede registrar cortes', async () => {
    await db.exec(`select set_config('prueba.uid', '', false)`);
    expect(await errorDe(corte('11:00'))).toBe('SIN_PERMISO');
  });

  it('guarda el corte como asistido y manual, aunque se cruce con otra cita', async () => {
    await db.exec(`select set_config('prueba.uid', '${ADMIN}', false)`);
    await corte('10:00'); // micki ya tiene una reserva web a las 10:00
    const r = await db.query<{ estado: string; origen: string; cliente: string }>(
      `select estado, origen, cliente from reservas where origen = 'manual'`,
    );
    expect(r.rows).toEqual([{ estado: 'asistio', origen: 'manual', cliente: 'Cliente en local' }]);
  });

  it('permite anotar cortes de horas que ya pasaron', async () => {
    const ayer = sumarDias(ahoraEn('America/La_Paz').fecha, -1);
    await expect(corte('15:00', ayer)).resolves.toBeDefined();
  });

  it('la página ya no deja reservar la hora de un corte manual', async () => {
    await corte('15:00');
    expect(await errorDe(reservar('15:15', { barbero: 'micki', cliente: 'Nuevo' }))).toBe(
      'HORA_OCUPADA',
    );
  });
});

describe('lista negra (0004)', () => {
  const enLista = async () =>
    (
      await db.query<{ cliente: string; servicio: string | null }>(
        'select cliente, servicio from lista_negra order by creado_en',
      )
    ).rows;

  beforeAll(async () => {
    await db.exec(migracionListaNegra);
    await db.exec(migracionListaNegra);
  });

  it('al cancelar una reserva de la página, el cliente entra a la lista negra', async () => {
    const antes = (await enLista()).length;
    await db.exec(`update reservas set estado = 'cancelada' where cliente = 'Ana'`);
    const ahora = await enLista();
    expect(ahora).toHaveLength(antes + 1);
    expect(ahora.at(-1)).toEqual({ cliente: 'Ana', servicio: 'Corte clásico' });
  });

  it('cancelar dos veces la misma reserva no la repite', async () => {
    const antes = (await enLista()).length;
    await db.exec(`update reservas set estado = 'cancelada' where cliente = 'Ana'`);
    expect(await enLista()).toHaveLength(antes);
  });

  it('si se deshace la cancelación, sale de la lista', async () => {
    await db.exec(`update reservas set estado = 'confirmada' where cliente = 'Ana'`);
    expect((await enLista()).some((f) => f.cliente === 'Ana')).toBe(false);
  });

  it('quitar un corte anotado a mano no manda a nadie a la lista negra', async () => {
    const antes = (await enLista()).length;
    await db.exec(`update reservas set estado = 'cancelada' where origen = 'manual'`);
    expect(await enLista()).toHaveLength(antes);
  });

  it('la clave pública no puede ver la lista negra', async () => {
    await db.exec('set role anon');
    try {
      expect(await errorDe(db.query('select * from lista_negra'))).toMatch(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});
