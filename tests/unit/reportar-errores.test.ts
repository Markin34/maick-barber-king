import { describe, expect, it, vi } from 'vitest';
import { escucharErrores } from '../../src/lib/reportar-errores';

const config = { url: 'https://demo.supabase.co', clave: 'sb_publishable_demo' };

function ventanaFalsa() {
  const oyentes = new Map<string, (e: Event) => void>();
  return {
    location: { origin: 'https://barberia.bo', pathname: '/reservar' } as Location,
    addEventListener: (tipo: string, fn: (e: Event) => void) => oyentes.set(tipo, fn),
    disparar: (tipo: string, datos: object) => oyentes.get(tipo)?.(datos as Event),
  };
}

describe('aviso de errores de la página', () => {
  it('anota errores propios una sola vez, con la página', () => {
    const v = ventanaFalsa();
    const enviar = vi.fn(async () => undefined);
    escucharErrores(config, v as unknown as Window, enviar);
    const error = new Error('x is undefined');
    v.disparar('error', {
      message: 'x is undefined',
      filename: 'https://barberia.bo/_astro/Reservador.js',
      error,
    });
    v.disparar('error', {
      message: 'x is undefined',
      filename: 'https://barberia.bo/_astro/Reservador.js',
      error,
    });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith(config, {
      mensaje: 'x is undefined',
      pagina: '/reservar',
      detalle: error.stack,
    });
  });

  it('ignora extensiones del navegador, ruido conocido y no pasa de 5 por visita', () => {
    const v = ventanaFalsa();
    const enviar = vi.fn(async () => undefined);
    escucharErrores(config, v as unknown as Window, enviar);
    v.disparar('error', { message: 'boom', filename: 'chrome-extension://abc/x.js' });
    v.disparar('error', { message: 'Script error.', filename: '' });
    v.disparar('unhandledrejection', { reason: new TypeError('Failed to fetch') });
    expect(enviar).not.toHaveBeenCalled();
    for (let i = 0; i < 8; i++) v.disparar('unhandledrejection', { reason: `falla ${i}` });
    expect(enviar).toHaveBeenCalledTimes(5);
  });
});
