import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { ahoraEn, sumarDias } from '../../src/lib/tiempo';
import { MIGRACIONES, como, crearBase, errorDe } from './db-prueba';

const DUENO = '11111111-1111-1111-1111-111111111111';
const CURIOSO = '22222222-2222-2222-2222-222222222222';
const dia = sumarDias(ahoraEn('America/La_Paz').fecha, 4);

let db: PGlite;

const reservar = (hora: string, cliente: string) =>
  db.query<{ id: string }>(
    `select * from crear_reserva('apu', 'Corte', $1::date, $2::time, 30, $3, null)`,
    [dia, hora, cliente],
  );

beforeAll(async () => {
  db = await crearBase();
  // Volver a correr la última migración no rompe nada (0001 se niega a correr de nuevo a propósito).
  const { readFileSync } = await import('node:fs');
  const ultima = MIGRACIONES.at(-1)!;
  await db.exec(readFileSync(new URL(`../../supabase/migrations/${ultima}`, import.meta.url), 'utf8'));
  await db.exec(`
    insert into auth.users (id, email) values
      ('${DUENO}', 'dueno@ejemplo.com'), ('${CURIOSO}', 'curioso@ejemplo.com');
    insert into administradores (user_id, nombre) values ('${DUENO}', 'Dueño');
  `);
  await reservar('10:00', 'Carlos');
  await reservar('11:00', 'Ana');
});

describe('panel de administración (permisos)', () => {
  it('el dueño ve todas las reservas', async () => {
    const r = await como(db, DUENO, () => db.query('select cliente from reservas order by inicio'));
    expect(r.rows).toEqual([{ cliente: 'Carlos' }, { cliente: 'Ana' }]);
    expect(
      (await como(db, DUENO, () => db.query<{ es: boolean }>('select es_admin() as es'))).rows[0]
        ?.es,
    ).toBe(true);
  });

  it('alguien con sesión que no es administrador no ve nada', async () => {
    const r = await como(db, CURIOSO, () => db.query('select * from reservas'));
    expect(r.rows).toHaveLength(0);
    const cambio = await como(db, CURIOSO, () =>
      db.query(`update reservas set estado = 'cancelada' returning id`),
    );
    expect(cambio.rows).toHaveLength(0);
    expect(
      await errorDe(como(db, CURIOSO, () => db.query('select * from administradores'))),
    ).toMatch(/permission denied/);
  });

  it('los clientes (clave pública) siguen sin poder leer reservas', async () => {
    expect(await errorDe(como(db, null, () => db.query('select * from reservas')))).toMatch(
      /permission denied/,
    );
  });

  it('el dueño solo puede cambiar el estado, no los datos de la reserva', async () => {
    const r = await como(db, DUENO, () =>
      db.query<{ estado: string }>(
        `update reservas set estado = 'asistio' where cliente = 'Carlos' returning estado`,
      ),
    );
    expect(r.rows[0]?.estado).toBe('asistio');
    expect(
      await errorDe(
        como(db, DUENO, () =>
          db.query(`update reservas set cliente = 'Otro' where cliente = 'Ana'`),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await errorDe(
        como(db, DUENO, () =>
          db.query(`update reservas set estado = 'inventado' where cliente = 'Ana'`),
        ),
      ),
    ).toMatch(/reservas_estado_valido/);
  });

  it('"asistió" y "no vino" siguen ocupando la hora; "cancelada" la libera', async () => {
    expect(await errorDe(reservar('10:00', 'Intruso'))).toBe('HORA_OCUPADA');
    await como(db, DUENO, () =>
      db.query(`update reservas set estado = 'cancelada' where cliente = 'Ana'`),
    );
    await expect(reservar('11:00', 'Pedro')).resolves.toBeDefined();
  });

  it('el dueño crea y borra bloqueos; otros no pueden', async () => {
    const insertar = `insert into bloqueos (barbero, inicio, fin, motivo)
      values ('apu', ($1::date + time '15:00') at time zone 'America/La_Paz',
                     ($1::date + time '16:00') at time zone 'America/La_Paz', 'Médico') returning id`;
    const creado = await como(db, DUENO, () => db.query<{ id: string }>(insertar, [dia]));
    expect(creado.rows).toHaveLength(1);
    expect(await errorDe(reservar('15:30', 'Luis'))).toBe('HORA_OCUPADA');

    expect(await errorDe(como(db, CURIOSO, () => db.query(insertar, [dia])))).toMatch(
      /row-level security/,
    );
    await como(db, DUENO, () =>
      db.query('delete from bloqueos where id = $1', [creado.rows[0]!.id]),
    );
    await expect(reservar('15:30', 'Luis')).resolves.toBeDefined();
  });
});
