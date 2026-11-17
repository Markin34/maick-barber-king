import { afterEach, describe, expect, it, vi } from 'vitest';
import { agruparOcupados, diasDisponibles, horasDelDia } from '../../src/lib/horarios';
import {
  cancelarReserva,
  crearReserva,
  ErrorReserva,
  obtenerOcupados,
  registrarError,
} from '../../src/lib/reservas-api';
import { configSupabase } from '../../src/lib/config';
import { mensajeReserva } from '../../src/lib/whatsapp';
import type { Negocio } from '../../src/data/schema';

const dia = { abre: '09:00', cierra: '12:00' };
const negocio: Pick<Negocio, 'horario' | 'intervaloMin' | 'diasAnticipacion' | 'minutosMinimos'> = {
  horario: {
    lunes: dia,
    martes: dia,
    miercoles: dia,
    jueves: dia,
    viernes: dia,
    sabado: dia,
    domingo: null,
  },
  intervaloMin: 30,
  diasAnticipacion: 3,
  minutosMinimos: 0,
};
const ahora = { fecha: '2026-11-08', minutos: 0 }; // domingo
const config = { url: 'https://demo.supabase.co', clave: 'sb_publishable_demo' };

describe('horas ocupadas', () => {
  it('convierte intervalos de la base de datos a la hora de Bolivia', () => {
    const mapa = agruparOcupados(
      [
        { inicio: '2026-11-09T14:00:00+00:00', fin: '2026-11-09T14:45:00+00:00' }, // 10:00–10:45 en La Paz
        { inicio: '2026-11-10T03:00:00Z', fin: '2026-11-10T05:00:00Z' }, // 23:00 del 9 a 01:00 del 10
        { inicio: 'no-es-fecha', fin: '2026-11-10T05:00:00Z' },
      ],
      'America/La_Paz',
    );
    expect(mapa.get('2026-11-09')).toEqual([
      [600, 645],
      [1380, 1440],
    ]);
    expect(mapa.get('2026-11-10')).toEqual([[0, 60]]);
  });

  it('marca como ocupadas las horas que se cruzan con una reserva', () => {
    const ocupados = new Map([['2026-11-09', [[600, 645]] as const]]);
    const horas = horasDelDia({
      negocio,
      barbero: {},
      servicio: { duracionMin: 30 },
      fecha: '2026-11-09',
      ahora,
      ocupados,
    });
    expect(horas.filter((h) => !h.libre).map((h) => h.hora)).toEqual(['10:00', '10:30']);
    expect(horas.find((h) => h.hora === '09:30')?.libre).toBe(true);
  });

  it('un día sin horas libres no aparece', () => {
    const lleno = new Map([['2026-11-09', [[0, 1440]] as const]]);
    const dias = diasDisponibles({
      negocio,
      barbero: {},
      servicio: { duracionMin: 30 },
      ahora,
      ocupados: lleno,
    });
    expect(dias).toEqual(['2026-11-10']);
  });
});

describe('cliente de Supabase', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('llama a la función con la clave pública y devuelve los intervalos', async () => {
    const fetchFalso = vi.fn(async () => Response.json([{ inicio: 'a', fin: 'b' }]));
    vi.stubGlobal('fetch', fetchFalso);
    const r = await obtenerOcupados(config, 'apu', '2026-11-09', '2026-11-20');
    expect(r).toEqual([{ inicio: 'a', fin: 'b' }]);
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://demo.supabase.co/rest/v1/rpc/horarios_ocupados');
    expect((init.headers as Record<string, string>).apikey).toBe('sb_publishable_demo');
    expect(JSON.parse(String(init.body))).toEqual({
      p_barbero: 'apu',
      p_desde: '2026-11-09',
      p_hasta: '2026-11-20',
    });
  });

  it('traduce los errores del servidor', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ message: 'HORA_OCUPADA' }, { status: 400 }));
    const reserva = {
      barbero: 'apu',
      servicio: 'Corte',
      fecha: '2026-11-09',
      hora: '10:00',
      duracionMin: 30,
      cliente: 'Ana',
    };
    await expect(crearReserva(config, reserva)).rejects.toMatchObject({ codigo: 'HORA_OCUPADA' });

    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const error = await crearReserva(config, reserva).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorReserva);
    expect((error as ErrorReserva).codigo).toBe('SIN_CONEXION');
  });

  it('devuelve el código de la reserva guardada', async () => {
    vi.stubGlobal('fetch', async () => Response.json([{ id: 'x', codigo: 'A1B2C3' }]));
    const r = await crearReserva(config, {
      barbero: 'apu',
      servicio: 'Corte',
      fecha: '2026-11-09',
      hora: '10:00',
      duracionMin: 30,
      cliente: ' Ana ',
    });
    expect(r.codigo).toBe('A1B2C3');
  });

  it('entiende el error de hora fuera de horario', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ message: 'FUERA_DE_HORARIO' }, { status: 400 }),
    );
    const r = crearReserva(config, {
      barbero: 'apu',
      servicio: 'Corte',
      fecha: '2026-11-09',
      hora: '03:00',
      duracionMin: 30,
      cliente: 'Ana',
    });
    await expect(r).rejects.toMatchObject({ codigo: 'FUERA_DE_HORARIO' });
  });

  it('cancela con código en mayúsculas y nombre sin espacios de más', async () => {
    const fetchFalso = vi.fn(async () => Response.json('CANCELADA'));
    vi.stubGlobal('fetch', fetchFalso);
    expect(await cancelarReserva(config, ' a1b2c3 ', ' Ana ')).toBe('CANCELADA');
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://demo.supabase.co/rest/v1/rpc/cancelar_reserva');
    expect(JSON.parse(String(init.body))).toEqual({ p_codigo: 'A1B2C3', p_cliente: 'Ana' });

    vi.stubGlobal('fetch', async () => Response.json('ALGO_RARO'));
    await expect(cancelarReserva(config, 'A1B2C3', 'Ana')).rejects.toMatchObject({
      codigo: 'DESCONOCIDO',
    });
  });

  it('registrar un error nunca lanza, aunque no haya internet', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(registrarError(config, { mensaje: 'x' })).resolves.toBeUndefined();
  });
});

describe('configuración', () => {
  it('sin variables funciona solo con WhatsApp', () => {
    expect(configSupabase({})).toBeUndefined();
  });

  it('acepta una configuración correcta', () => {
    expect(
      configSupabase({
        PUBLIC_SUPABASE_URL: 'https://abc.supabase.co/',
        PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
      }),
    ).toEqual({ url: 'https://abc.supabase.co', clave: 'sb_publishable_x' });
  });

  it('frena configuraciones peligrosas o incompletas', () => {
    expect(() => configSupabase({ PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' })).toThrow(
      /Falta/,
    );
    expect(() =>
      configSupabase({
        PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
        PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_123',
      }),
    ).toThrow(/SECRETA/);
    expect(() =>
      configSupabase({ PUBLIC_SUPABASE_URL: 'abc', PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'x' }),
    ).toThrow(/válida/);
  });
});

describe('mensaje con código', () => {
  it('cuando la reserva ya está guardada, avisa en vez de pedir confirmación', () => {
    const msg = mensajeReserva({
      negocio: 'Maick Barber King',
      barbero: 'Apu',
      servicio: 'Corte',
      precio: 40,
      duracionMin: 30,
      fecha: '2026-11-14',
      hora: '10:00',
      cliente: 'Ana',
      formaDePago: 'Pagas en la barbería, en efectivo.',
      codigo: 'A1B2C3',
    });
    expect(msg).toContain('Hola Apu, reservé en Maick Barber King:');
    expect(msg).toContain('🔖 Reserva A1B2C3');
    expect(msg).not.toContain('¿Me confirmas');
  });
});
