import { describe, expect, it } from 'vitest';
import {
  diasDisponibles,
  horarioDelDia,
  horasDisponibles,
  proximaHoraLibre,
} from '../../src/lib/horarios';
import { ahoraEn, aMinutos, diaDeSemana, sumarDias } from '../../src/lib/tiempo';
import type { Negocio } from '../../src/data/schema';

const dia = { abre: '09:00', cierra: '12:00' };
const negocio: Pick<Negocio, 'horario' | 'intervaloMin' | 'diasAnticipacion' | 'minutosMinimos'> = {
  horario: {
    lunes: { ...dia, descanso: { desde: '10:00', hasta: '10:30' } },
    martes: dia,
    miercoles: dia,
    jueves: dia,
    viernes: dia,
    sabado: dia,
    domingo: null,
  },
  intervaloMin: 30,
  diasAnticipacion: 7,
  minutosMinimos: 30,
};
const sinHorarioPropio = {};
const corte = { duracionMin: 30 };
// 2026-11-09 es lunes; "ahora" es el domingo anterior para que no influya la hora actual.
const LUNES = '2026-11-09';
const domingoPrevio = { fecha: '2026-11-08', minutos: 0 };

describe('tiempo', () => {
  it('suma días cruzando mes y año', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('calcula el día de la semana', () => {
    expect(diaDeSemana(LUNES)).toBe(1);
    expect(diaDeSemana('2026-11-08')).toBe(0);
  });

  it('usa la hora de Bolivia sin importar la del equipo', () => {
    // 03:30 UTC del 10 de noviembre = 23:30 del 9 de noviembre en La Paz (UTC-4)
    const ahora = ahoraEn('America/La_Paz', new Date('2026-11-10T03:30:00Z'));
    expect(ahora).toEqual({ fecha: '2026-11-09', minutos: aMinutos('23:30') });
  });
});

describe('horasDisponibles', () => {
  it('ofrece horas cada intervalo y respeta el descanso', () => {
    const horas = horasDisponibles({
      negocio,
      barbero: sinHorarioPropio,
      servicio: corte,
      fecha: LUNES,
      ahora: domingoPrevio,
    });
    expect(horas).toEqual(['09:00', '09:30', '10:30', '11:00', '11:30', '12:00']);
  });

  it('se puede reservar hasta la hora de cierre, aunque el servicio termine después', () => {
    const horas = horasDisponibles({
      negocio,
      barbero: sinHorarioPropio,
      servicio: { duracionMin: 60 },
      fecha: '2026-11-10',
      ahora: domingoPrevio,
    });
    expect(horas.at(-1)).toBe('12:00');
  });

  it('no permite que un servicio largo pise el descanso', () => {
    const horas = horasDisponibles({
      negocio,
      barbero: sinHorarioPropio,
      servicio: { duracionMin: 60 },
      fecha: LUNES,
      ahora: domingoPrevio,
    });
    expect(horas).toEqual(['09:00', '10:30', '11:00', '11:30', '12:00']);
  });

  it('hoy solo muestra horas con la anticipación mínima', () => {
    const ahora = { fecha: '2026-11-10', minutos: aMinutos('09:40') };
    const horas = horasDisponibles({
      negocio,
      barbero: sinHorarioPropio,
      servicio: corte,
      fecha: '2026-11-10',
      ahora,
    });
    expect(horas[0]).toBe('10:30');
  });

  it('no ofrece fechas pasadas ni días cerrados', () => {
    const ahora = { fecha: '2026-11-10', minutos: 0 };
    expect(
      horasDisponibles({
        negocio,
        barbero: sinHorarioPropio,
        servicio: corte,
        fecha: LUNES,
        ahora,
      }),
    ).toEqual([]);
    expect(
      horasDisponibles({
        negocio,
        barbero: sinHorarioPropio,
        servicio: corte,
        fecha: '2026-11-15',
        ahora: domingoPrevio,
      }),
    ).toEqual([]);
  });

  it('usa el horario propio del barbero cuando lo tiene', () => {
    const barbero = { horario: { lunes: null, sabado: { abre: '10:00', cierra: '11:00' } } };
    expect(horarioDelDia(negocio, barbero, LUNES)).toBeNull();
    expect(
      horasDisponibles({
        negocio,
        barbero,
        servicio: corte,
        fecha: '2026-11-14',
        ahora: domingoPrevio,
      }),
    ).toEqual(['10:00', '10:30', '11:00']);
  });
});

describe('cada 15 minutos', () => {
  const cada15 = { ...negocio, intervaloMin: 15 as const };
  const martes = '2026-11-10';

  it('una reserva a las 9:15 de 30 minutos solo ocupa de 9:15 a 9:45', () => {
    const ocupados = new Map([[martes, [[aMinutos('09:15'), aMinutos('09:45')] as const]]]);
    const horas = horasDisponibles({
      negocio: cada15,
      barbero: sinHorarioPropio,
      servicio: corte,
      fecha: martes,
      ahora: domingoPrevio,
      ocupados,
    });
    // 9:00 terminaría a las 9:30 (se cruza); 9:45 ya está libre.
    expect(horas.slice(0, 3)).toEqual(['09:45', '10:00', '10:15']);
    expect(horas).not.toContain('09:30');
  });

  it('la última hora para reservar es la del cierre', () => {
    const horas = horasDisponibles({
      negocio: cada15,
      barbero: sinHorarioPropio,
      servicio: corte,
      fecha: martes,
      ahora: domingoPrevio,
    });
    expect(horas.at(-1)).toBe('12:00');
    expect(horas).toHaveLength(13);
  });
});

describe('última reserva antes del cierre', () => {
  it('con 30 minutos y cierre a las 12:00, la última reserva es 11:30 para cualquier servicio', () => {
    const reglas = { ...negocio, intervaloMin: 15 as const, ultimaReservaAntesDelCierre: 30 };
    for (const duracionMin of [15, 30, 45, 60]) {
      const horas = horasDisponibles({
        negocio: reglas,
        barbero: sinHorarioPropio,
        servicio: { duracionMin },
        fecha: '2026-11-10',
        ahora: domingoPrevio,
      });
      expect(horas.at(-1)).toBe('11:30');
    }
  });
});

describe('proximaHoraLibre', () => {
  it('cada barbero tiene la suya según su propia agenda', () => {
    const martes = '2026-11-10';
    const ahora = { fecha: martes, minutos: 0 };
    const llenoMartes = new Map([[martes, [[0, 24 * 60] as const]]]);
    expect(
      proximaHoraLibre({ negocio, barbero: sinHorarioPropio, servicio: corte, ahora }),
    ).toEqual({ fecha: martes, hora: '09:00' });
    expect(
      proximaHoraLibre({
        negocio,
        barbero: sinHorarioPropio,
        servicio: corte,
        ahora,
        ocupados: llenoMartes,
      }),
    ).toEqual({ fecha: '2026-11-11', hora: '09:00' });
  });
});

describe('diasDisponibles', () => {
  it('salta los días sin atención y los que ya no tienen horas', () => {
    const ahora = { fecha: LUNES, minutos: aMinutos('11:45') };
    const dias = diasDisponibles({ negocio, barbero: sinHorarioPropio, servicio: corte, ahora });
    expect(dias[0]).toBe('2026-11-10');
    expect(dias).not.toContain('2026-11-15');
    expect(dias).toHaveLength(5);
  });
});
