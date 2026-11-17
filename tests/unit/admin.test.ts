import { describe, expect, it } from 'vitest';
import {
  aCita,
  aInstante,
  buscarCitas,
  citasPorBarbero,
  inicioDeSemana,
  resumir,
  type FilaReserva,
} from '../../src/lib/admin';

const fila = (p: Partial<FilaReserva>): FilaReserva => ({
  id: crypto.randomUUID(),
  codigo: 'AAAAAA',
  barbero: 'apu',
  servicio: 'Corte clásico',
  inicio: '2026-11-14T14:00:00+00:00',
  fin: '2026-11-14T14:30:00+00:00',
  cliente: 'Carlos Pérez',
  nota: null,
  estado: 'confirmada',
  creada_en: '2026-11-10T12:00:00Z',
  ...p,
});
const Z = 'America/La_Paz';

describe('panel: lógica', () => {
  it('convierte la hora a Bolivia', () => {
    const c = aCita(fila({}), Z);
    expect(c).toMatchObject({ fecha: '2026-11-14', hora: '10:00', horaFin: '10:30' });
    expect(aInstante('2026-11-14', '13:00')).toBe('2026-11-14T13:00:00-04:00');
  });

  it('agrupa las citas del día por barbero, en orden', () => {
    const citas = [
      fila({ inicio: '2026-11-14T16:00:00Z', fin: '2026-11-14T16:30:00Z', cliente: 'Tarde' }),
      fila({ cliente: 'Temprano' }),
      fila({ barbero: 'micki', cliente: 'Micki' }),
      fila({ inicio: '2026-11-15T14:00:00Z', fin: '2026-11-15T14:30:00Z', cliente: 'Otro día' }),
    ].map((f) => aCita(f, Z));
    const mapa = citasPorBarbero(citas, '2026-11-14', [
      { id: 'micki' },
      { id: 'apu' },
      { id: 'victor' },
    ]);
    expect([...mapa.keys()]).toEqual(['micki', 'apu', 'victor']);
    expect(mapa.get('apu')?.map((c) => c.cliente)).toEqual(['Temprano', 'Tarde']);
    expect(mapa.get('victor')).toEqual([]);
  });

  it('busca sin importar tildes ni mayúsculas, y por código', () => {
    const citas = [fila({ cliente: 'José Pérez', codigo: 'B7C9D1' }), fila({ cliente: 'Ana' })].map(
      (f) => aCita(f, Z),
    );
    expect(buscarCitas(citas, 'jose perez').map((c) => c.cliente)).toEqual(['José Pérez']);
    expect(buscarCitas(citas, 'b7c').map((c) => c.cliente)).toEqual(['José Pérez']);
    expect(buscarCitas(citas, 'a')).toEqual([]);
  });

  it('calcula el lunes de la semana', () => {
    expect(inicioDeSemana('2026-11-14')).toBe('2026-11-09');
    expect(inicioDeSemana('2026-11-15')).toBe('2026-11-09');
    expect(inicioDeSemana('2026-11-09')).toBe('2026-11-09');
  });

  it('resume citas e ingresos sin contar canceladas ni faltas', () => {
    const precios: Record<string, number> = { 'Corte clásico': 40, Barba: 30 };
    const citas = [
      fila({ estado: 'asistio' }),
      fila({ estado: 'confirmada', servicio: 'Barba', barbero: 'micki' }),
      fila({ estado: 'cancelada' }),
      fila({ estado: 'no_vino' }),
    ].map((f) => aCita(f, Z));
    const r = resumir(citas, '2026-11-14', '2026-11-14', (s) => precios[s] ?? 0);
    expect(r).toMatchObject({
      total: 4,
      atendidas: 1,
      pendientes: 1,
      noVinieron: 1,
      canceladas: 1,
      ingresos: 70,
    });
    expect(r.porBarbero).toHaveLength(2);
  });
});
