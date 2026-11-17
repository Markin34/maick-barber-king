import { describe, expect, it } from 'vitest';
import { cargarCatalogo, catalogo, ErrorDeDatos } from '../../src/data';
import { negocio } from '../../src/data/negocio';
import { barberos } from '../../src/data/barberos';
import { servicios } from '../../src/data/servicios';
import { productos } from '../../src/data/productos';

const base = { negocio, barberos, servicios, productos };

describe('datos de la barbería', () => {
  it('los datos actuales son válidos', () => {
    expect(catalogo.barberos.length).toBeGreaterThan(0);
    expect(catalogo.negocio.zonaHoraria).toBe('America/La_Paz');
  });

  it('rechaza un WhatsApp sin código de Bolivia', () => {
    const malos = [{ ...barberos[0], whatsapp: '71111111' }];
    expect(() => cargarCatalogo({ ...base, barberos: malos })).toThrow(
      /barberos\.ts[\s\S]*whatsapp/,
    );
  });

  it('rechaza un horario que cierra antes de abrir', () => {
    const malo = {
      ...negocio,
      horario: { ...negocio.horario, lunes: { abre: '20:00', cierra: '09:00' } },
    };
    expect(() => cargarCatalogo({ ...base, negocio: malo })).toThrow(ErrorDeDatos);
  });

  it('rechaza ids repetidos y servicios inexistentes', () => {
    expect(() => cargarCatalogo({ ...base, servicios: [...servicios, servicios[0]] })).toThrow(
      /repetido/,
    );
    const conServicioMalo = [{ ...barberos[0], servicios: ['no-existe'] }];
    expect(() => cargarCatalogo({ ...base, barberos: conServicioMalo })).toThrow(/no existe/);
  });
});
