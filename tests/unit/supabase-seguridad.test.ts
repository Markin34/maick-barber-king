/**
 * 0005_seguridad.sql: la base valida las reservas con el catálogo real, limita por conexión,
 * deja cancelar con código y nombre, y guarda errores de la página.
 */
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { catalogo } from '../../src/data';
import { catalogoSql } from '../../src/lib/catalogo-sql';
import { ahoraEn, diaDeSemana, sumarDias } from '../../src/lib/tiempo';
import { como, crearBase, errorDe } from './db-prueba';

const TODAS = [
  '0001_reservas.sql',
  '0002_admin.sql',
  '0003_cortes_manuales.sql',
  '0004_lista_negra.sql',
  '0005_seguridad.sql',
] as const;
const leer = (archivo: string) =>
  readFileSync(new URL(`../../supabase/migrations/${archivo}`, import.meta.url), 'utf8');

const hoy = ahoraEn('America/La_Paz').fecha;
/** Jueves a sábado trabajan todos (Víctor libra lunes, Apu martes, Micki miércoles). */
const trabajanTodos = (f: string) => diaDeSemana(f) >= 4;
/** Próximo día (desde mañana) en que trabajan todos. */
const diaHabil = (desde = 1) => {
  for (let i = desde; ; i++) {
    const f = sumarDias(hoy, i);
    if (trabajanTodos(f)) return f;
  }
};
const DIA = diaHabil();
const DOMINGO = (() => {
  for (let i = 1; ; i++) if (diaDeSemana(sumarDias(hoy, i)) === 0) return sumarDias(hoy, i);
})();
const LUNES = (() => {
  for (let i = 1; ; i++) if (diaDeSemana(sumarDias(hoy, i)) === 1) return sumarDias(hoy, i);
})();

let db: PGlite;
let nombre = 0;
/** Nombre distinto en cada reserva, para no chocar con el tope por nombre. */
const otroNombre = () => `Cliente ${++nombre}`;

async function conIp<T>(ip: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.headers', $1, false)`, [
    ip ? JSON.stringify({ 'cf-connecting-ip': ip, 'user-agent': 'Prueba/1.0' }) : '',
  ]);
  try {
    return await como(db, null, fn);
  } finally {
    await db.query(`select set_config('request.headers', '', false)`);
  }
}

function reservar(o: {
  fecha?: string;
  hora: string;
  barbero?: string;
  servicio?: string;
  duracion?: number;
  cliente?: string;
  ip?: string | null;
}) {
  return conIp(o.ip ?? null, async () => {
    const r = await db.query<{ id: string; codigo: string }>(
      'select * from crear_reserva($1, $2, $3::date, $4::time, $5, $6, null)',
      [
        o.barbero ?? 'micki',
        o.servicio ?? 'Corte normal',
        o.fecha ?? DIA,
        o.hora,
        o.duracion ?? 30,
        o.cliente ?? otroNombre(),
      ],
    );
    return r.rows[0]!;
  });
}

const cancelar = (codigo: string, cliente: string, ip: string | null = '9.9.9.9') =>
  conIp(ip, async () => {
    const r = await db.query<{ r: string }>('select cancelar_reserva($1, $2) as r', [
      codigo,
      cliente,
    ]);
    return r.rows[0]!.r;
  });

beforeAll(async () => {
  db = await crearBase(TODAS);
  await db.exec(leer('0005_seguridad.sql')); // se puede volver a correr
  await db.exec(catalogoSql(catalogo));
  await db.exec(catalogoSql(catalogo)); // y el catálogo también
});

describe('crear_reserva valida contra el catálogo', () => {
  it('guarda una reserva válida y usa la duración del catálogo, no la del navegador', async () => {
    const r = await reservar({ hora: '10:00', duracion: 300 });
    const fila = await db.query<{ minutos: number }>(
      `select extract(epoch from fin - inicio)::int / 60 as minutos from reservas where id = $1`,
      [r.id],
    );
    expect(fila.rows[0]?.minutos).toBe(30);
  });

  it('rechaza servicios inventados y barberos que no existen', async () => {
    expect(await errorDe(reservar({ hora: '11:00', servicio: 'Corte de 5 horas' }))).toBe(
      'DATOS_INVALIDOS',
    );
    expect(await errorDe(reservar({ hora: '11:00', barbero: 'fantasma' }))).toBe(
      'DATOS_INVALIDOS',
    );
  });

  it('rechaza horas fuera del horario, desalineadas o en días cerrados', async () => {
    expect(await errorDe(reservar({ hora: '08:00' }))).toBe('FUERA_DE_HORARIO');
    // Almuerzo de 12:00 a 14:00.
    expect(await errorDe(reservar({ hora: '12:30' }))).toBe('FUERA_DE_HORARIO');
    expect(await errorDe(reservar({ hora: '11:45' }))).toBe('FUERA_DE_HORARIO');
    await expect(reservar({ hora: '08:30' })).resolves.toBeDefined();
    await expect(reservar({ hora: '14:00' })).resolves.toBeDefined();
    expect(await errorDe(reservar({ hora: '03:00' }))).toBe('FUERA_DE_HORARIO');
    expect(await errorDe(reservar({ hora: '20:15' }))).toBe('FUERA_DE_HORARIO');
    expect(await errorDe(reservar({ hora: '11:10' }))).toBe('FUERA_DE_HORARIO');
    expect(await errorDe(reservar({ hora: '11:00:30' }))).toBe('FUERA_DE_HORARIO');
    expect(await errorDe(reservar({ fecha: DOMINGO, hora: '11:00' }))).toBe('FUERA_DE_HORARIO');
    // Víctor no trabaja los lunes, Micki sí.
    expect(await errorDe(reservar({ fecha: LUNES, hora: '11:00', barbero: 'victor' }))).toBe(
      'FUERA_DE_HORARIO',
    );
    await expect(reservar({ fecha: LUNES, hora: '11:00', barbero: 'micki' })).resolves.toBeDefined();
  });

  it('acepta la última hora del día (cierre menos 30 minutos)', async () => {
    await expect(reservar({ hora: '20:00', barbero: 'apu' })).resolves.toBeDefined();
  });

  it('respeta los días de anticipación de negocio.ts', async () => {
    const ultimo = sumarDias(hoy, catalogo.negocio.diasAnticipacion - 1);
    const fuera = sumarDias(hoy, catalogo.negocio.diasAnticipacion);
    expect(await errorDe(reservar({ fecha: fuera, hora: '10:00' }))).toMatch(
      /MUY_LEJOS|FUERA_DE_HORARIO/,
    );
    if (trabajanTodos(ultimo)) {
      await expect(reservar({ fecha: ultimo, hora: '10:00' })).resolves.toBeDefined();
    }
  });

  it('sin catálogo cargado avisa SIN_CATALOGO en vez de aceptar cualquier cosa', async () => {
    const vacia = await crearBase(TODAS);
    const r = vacia.query(`select * from crear_reserva('micki','Corte normal',$1::date,'10:00',30,'Ana',null)`, [
      DIA,
    ]);
    expect(await errorDe(r)).toBe('SIN_CATALOGO');
    await vacia.close();
  });
});

describe('cada reserva queda con su barbero', () => {
  it('los tres a la misma hora: cada uno recibe la suya y no se mezclan', async () => {
    const dia = diaHabil(4);
    for (const barbero of ['micki', 'apu', 'victor']) {
      await reservar({ fecha: dia, hora: '17:00', barbero, cliente: `Cliente de ${barbero}` });
    }
    // El mismo barbero no puede tener dos citas que se crucen.
    expect(await errorDe(reservar({ fecha: dia, hora: '17:15', barbero: 'apu' }))).toBe(
      'HORA_OCUPADA',
    );

    const r = await db.query<{ barbero: string; cliente: string }>(
      `select barbero, cliente from reservas
        where inicio::date = $1::date and cliente like 'Cliente de %' order by barbero`,
      [dia],
    );
    expect(r.rows).toEqual([
      { barbero: 'apu', cliente: 'Cliente de apu' },
      { barbero: 'micki', cliente: 'Cliente de micki' },
      { barbero: 'victor', cliente: 'Cliente de victor' },
    ]);

    // Lo que ve el cliente en la página: a las 17:00 Micki tiene ocupada solo su propia cita.
    const ocupadas = await como(db, null, () =>
      db.query<{ n: number }>(
        `select count(*)::int as n from horarios_ocupados('micki', $1::date, $1::date)
          where (inicio at time zone 'America/La_Paz')::time between '16:30' and '17:30'`,
        [dia],
      ),
    );
    expect(ocupadas.rows[0]?.n).toBe(1);
  });
});

describe('límite por conexión', () => {
  it('4 reservas por hora desde la misma IP; la quinta se rechaza, otra IP sigue pudiendo', async () => {
    const dia = diaHabil(2);
    for (const hora of ['09:00', '09:30', '10:00', '10:30']) {
      await reservar({ fecha: dia, hora, barbero: 'apu', ip: '1.2.3.4' });
    }
    expect(await errorDe(reservar({ fecha: dia, hora: '11:00', barbero: 'apu', ip: '1.2.3.4' }))).toBe(
      'DEMASIADAS_RESERVAS',
    );
    await expect(
      reservar({ fecha: dia, hora: '11:00', barbero: 'apu', ip: '5.6.7.8' }),
    ).resolves.toBeDefined();
  });

  it('la IP se guarda cifrada, nunca tal cual', async () => {
    const r = await db.query<{ ip_hash: string }>('select ip_hash from limites_ip');
    expect(r.rows.length).toBeGreaterThan(0);
    for (const { ip_hash } of r.rows) {
      expect(ip_hash).toMatch(/^[0-9a-f]{32}$/);
      expect(ip_hash).not.toContain('1.2.3.4');
    }
  });
});

describe('cancelar_reserva', () => {
  let codigo: string;
  const dia = diaHabil(3);

  beforeEach(async () => {
    await db.exec('delete from limites_ip');
  });

  it('cancela con el código y el nombre, sin importar mayúsculas ni espacios', async () => {
    codigo = (await reservar({ fecha: dia, hora: '15:00', cliente: 'José Pérez' })).codigo;
    expect(await cancelar(codigo.toLowerCase(), '  JOSé   PéREZ ')).toBe('CANCELADA');
    const r = await db.query<{ estado: string }>('select estado from reservas where codigo = $1', [
      codigo,
    ]);
    expect(r.rows[0]?.estado).toBe('cancelada');
  });

  it('la hora queda libre otra vez', async () => {
    await expect(reservar({ fecha: dia, hora: '15:00' })).resolves.toBeDefined();
  });

  it('en la lista negra queda que canceló el cliente desde la página', async () => {
    const r = await db.query<{ motivo: string }>(
      `select motivo from lista_negra where cliente = 'José Pérez'`,
    );
    expect(r.rows).toEqual([{ motivo: 'Canceló desde la página' }]);
  });

  it('no cancela con otro nombre, ni dos veces, ni códigos raros', async () => {
    const otro = (await reservar({ fecha: dia, hora: '16:00', cliente: 'Ana Rojas' })).codigo;
    expect(await cancelar(otro, 'Otra Persona')).toBe('NO_ENCONTRADA');
    expect(await cancelar(codigo, 'José Pérez')).toBe('NO_ENCONTRADA');
    expect(await cancelar("' or 1=1 --", 'Ana Rojas')).toBe('NO_ENCONTRADA');
    const r = await db.query<{ estado: string }>('select estado from reservas where codigo = $1', [
      otro,
    ]);
    expect(r.rows[0]?.estado).toBe('confirmada');
  });

  it('no deja cancelar a menos de una hora de la cita', async () => {
    await db.exec(`
      insert into reservas (barbero, servicio, inicio, fin, cliente, codigo)
      values ('victor', 'Corte normal', now() + interval '40 minutes', now() + interval '70 minutes',
              'Llega Tarde', 'ABCDEF')`);
    expect(await cancelar('ABCDEF', 'Llega Tarde')).toBe('MUY_TARDE');
  });

  it('después de 10 intentos en una hora desde la misma IP, frena', async () => {
    for (let i = 0; i < 10; i++) expect(await cancelar('000000', 'Nadie')).toBe('NO_ENCONTRADA');
    expect(await cancelar('000000', 'Nadie')).toBe('DEMASIADOS_INTENTOS');
    expect(await cancelar('000000', 'Nadie', '4.4.4.4')).toBe('NO_ENCONTRADA');
  });
});

describe('errores de la página', () => {
  it('la clave pública puede anotar un error, recortado, pero no leerlos', async () => {
    await conIp('7.7.7.7', async () => {
      await db.query('select registrar_error($1, $2, $3)', ['x'.repeat(1000), '/reservar', null]);
      expect(await errorDe(db.query('select * from errores_web'))).toMatch(/permission denied/);
    });
    const r = await db.query<{ largo: number; navegador: string }>(
      'select char_length(mensaje) as largo, navegador from errores_web',
    );
    expect(r.rows).toEqual([{ largo: 300, navegador: 'Prueba/1.0' }]);
  });

  it('ignora errores de más desde la misma conexión (20 por hora)', async () => {
    await conIp('8.8.8.8', async () => {
      for (let i = 0; i < 25; i++) await db.query(`select registrar_error('falla', null, null)`);
    });
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from errores_web where mensaje = 'falla'`,
    );
    expect(r.rows[0]?.n).toBe(20);
  });
});

describe('las tablas nuevas no se ven desde la página', () => {
  it.each([
    'catalogo_reglas',
    'catalogo_servicios',
    'catalogo_horarios',
    'catalogo_barbero_servicios',
    'limites_ip',
    'secreto_ip',
  ])('%s', async (tabla) => {
    await como(db, null, async () => {
      expect(await errorDe(db.query(`select * from ${tabla}`))).toMatch(/permission denied/);
    });
  });
});

describe('volver a correr migraciones viejas', () => {
  it.each(['0001_reservas.sql', '0002_admin.sql', '0003_cortes_manuales.sql', '0004_lista_negra.sql'])(
    '%s se detiene sin cambiar nada',
    async (archivo) => {
      expect(await errorDe(db.exec(leer(archivo)))).toMatch(/NO VUELVAS A CORRER/);
    },
  );

  it('crear_reserva sigue siendo la versión segura', async () => {
    expect(await errorDe(reservar({ hora: '03:00' }))).toBe('FUERA_DE_HORARIO');
  });
});
