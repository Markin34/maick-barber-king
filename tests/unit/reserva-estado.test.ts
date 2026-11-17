import { describe, expect, it } from 'vitest';
import {
  ESTADO_INICIAL,
  reducirReserva,
  type Accion,
  type EstadoReserva,
} from '../../src/components/react/reservar/estado';

const aplicar = (...acciones: Accion[]): EstadoReserva =>
  acciones.reduce(reducirReserva, ESTADO_INICIAL);

describe('estado del reservador', () => {
  it('avanza por los pasos y recuerda hacia dónde va la animación', () => {
    const e = aplicar(
      { tipo: 'elegirBarbero', barberoId: 'apu', serviciosDelBarbero: ['corte'] },
      { tipo: 'elegirServicio', servicioId: 'corte' },
    );
    expect(e).toMatchObject({ paso: 2, barberoId: 'apu', servicioId: 'corte', direccion: 1 });
    expect(reducirReserva(e, { tipo: 'irA', paso: 1 }).direccion).toBe(-1);
  });

  it('al cambiar a un barbero que no hace el servicio elegido, lo borra', () => {
    const e = aplicar(
      { tipo: 'elegirBarbero', barberoId: 'apu', serviciosDelBarbero: ['corte', 'barba'] },
      { tipo: 'elegirServicio', servicioId: 'barba' },
      { tipo: 'irA', paso: 0 },
      { tipo: 'elegirBarbero', barberoId: 'micki', serviciosDelBarbero: ['corte'] },
    );
    expect(e.servicioId).toBeUndefined();
    const sigue = aplicar(
      { tipo: 'elegirBarbero', barberoId: 'apu', serviciosDelBarbero: ['corte'] },
      { tipo: 'elegirServicio', servicioId: 'corte' },
      { tipo: 'elegirBarbero', barberoId: 'micki', serviciosDelBarbero: ['corte'] },
    );
    expect(sigue.servicioId).toBe('corte');
  });

  it('cambiar de día borra la hora elegida', () => {
    const e = aplicar(
      { tipo: 'elegirHora', hora: '10:00' },
      { tipo: 'elegirFecha', fecha: '2026-11-20' },
    );
    expect(e.hora).toBeUndefined();
  });

  it('si alguien ganó la hora, vuelve al paso 2 con aviso y pide horarios de nuevo', () => {
    const e = aplicar(
      { tipo: 'irA', paso: 3 },
      { tipo: 'elegirHora', hora: '10:00' },
      { tipo: 'envioIniciado' },
      { tipo: 'envioFallido', codigo: 'HORA_OCUPADA' },
    );
    expect(e).toMatchObject({ paso: 2, enviando: false, hora: undefined, versionOcupados: 1 });
    expect(e.aviso).toMatch(/Alguien acaba de reservar/);
  });

  it('otros errores se quedan en el paso de datos', () => {
    const e = aplicar(
      { tipo: 'irA', paso: 3 },
      { tipo: 'envioIniciado' },
      { tipo: 'envioFallido', codigo: 'SIN_CONEXION' },
    );
    expect(e).toMatchObject({ paso: 3, enviando: false, errorEnvio: 'SIN_CONEXION' });
  });

  it('al confirmar pasa a la pantalla final y "otra reserva" conserva el nombre', () => {
    const e = aplicar(
      { tipo: 'escribir', campo: 'cliente', valor: 'Carlos' },
      {
        tipo: 'envioExitoso',
        confirmada: { codigo: 'ABC123', fecha: '2026-11-20', hora: '10:00' },
      },
    );
    expect(e.paso).toBe(4);
    const otra = reducirReserva(e, { tipo: 'reiniciar' });
    expect(otra).toMatchObject({ paso: 0, cliente: 'Carlos' });
    expect(otra.confirmada).toBeUndefined();
  });
});
