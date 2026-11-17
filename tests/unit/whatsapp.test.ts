import { describe, expect, it } from 'vitest';
import { linkWhatsApp, mensajePedido, mensajeReserva } from '../../src/lib/whatsapp';
import { duracion, fechaCorta, fechaLarga, formatoBs, hora12 } from '../../src/lib/formato';

describe('formato', () => {
  it('formatea bolivianos', () => {
    expect(formatoBs(40)).toBe('Bs 40');
    expect(formatoBs(1250)).toBe('Bs 1.250');
  });

  it('formatea fechas y horas en español', () => {
    expect(fechaLarga('2026-11-14')).toBe('Sábado 14 de noviembre');
    expect(fechaCorta('2026-11-14')).toEqual({ dia: 'Sáb', numero: '14', mes: 'nov' });
    expect(hora12('09:00')).toBe('9:00 am');
    expect(hora12('12:30')).toBe('12:30 pm');
    expect(hora12('16:00')).toBe('4:00 pm');
    expect(duracion(45)).toBe('45 min');
    expect(duracion(60)).toBe('1 h');
    expect(duracion(90)).toBe('1 h 30 min');
  });
});

describe('whatsapp', () => {
  it('arma el link solo con dígitos y el texto codificado', () => {
    const link = linkWhatsApp('+591 71111111', 'Hola, ¿qué tal? Ñandú & co ✂️📅');
    // api.whatsapp.com y no wa.me: wa.me rompe los emojis al abrirse en computadora.
    expect(link.startsWith('https://api.whatsapp.com/send?phone=59171111111&text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1] ?? '')).toBe(
      'Hola, ¿qué tal? Ñandú & co ✂️📅',
    );
  });

  it('arma el mensaje de reserva', () => {
    const msg = mensajeReserva({
      negocio: 'Maick Barber King',
      barbero: 'Micki',
      servicio: 'Corte + barba',
      precio: 70,
      duracionMin: 60,
      fecha: '2026-11-14',
      hora: '16:00',
      cliente: '  Carlos   Pérez ',
      nota: 'Llego\ncon mi hijo',
      formaDePago: 'Pagas en la barbería, en efectivo.',
    });
    expect(msg).toContain('Hola Micki, quiero reservar en Maick Barber King:');
    expect(msg).toContain('Corte + barba · Bs 70 · 1 h');
    expect(msg).toContain('Sábado 14 de noviembre');
    expect(msg).toContain('4:00 pm');
    expect(msg).toContain('👤 Carlos Pérez');
    expect(msg).toContain('📝 Llego con mi hijo');
  });

  it('arma el mensaje de pedido con el total', () => {
    const msg = mensajePedido({
      negocio: 'Maick Barber King',
      lineas: [
        { nombre: 'Cera mate', cantidad: 2, precio: 60 },
        { nombre: 'Aceite para barba', cantidad: 1, precio: 70 },
      ],
      cliente: 'Carlos',
      formaDePago: 'Pagas en la barbería, en efectivo.',
    });
    expect(msg).toContain('• 2 × Cera mate · Bs 120');
    expect(msg).toContain('Total: Bs 190');
    expect(msg).toContain('A nombre de: Carlos');
  });

  it('sin precio publicado, pide confirmar el precio en vez de dar un total', () => {
    const msg = mensajePedido({
      negocio: 'Maick Barber King',
      lineas: [{ nombre: 'Minoxidil', cantidad: 2 }],
      formaDePago: 'Pagas en la barbería, en efectivo.',
    });
    expect(msg).toContain('• 2 × Minoxidil\n');
    expect(msg).not.toContain('Total');
    expect(msg).toContain('¿Me confirmas el precio y si lo tienen?');
  });
});
