import { duracion, fechaLarga, formatoBs, hora12 } from './formato';

/**
 * Link que abre WhatsApp (app o web) con el mensaje ya escrito.
 * No usar wa.me: en computadora redirige y cambia los emojis por "�".
 */
export function linkWhatsApp(numero: string, mensaje: string): string {
  const digitos = numero.replace(/\D/g, '');
  return `https://api.whatsapp.com/send?phone=${digitos}&text=${encodeURIComponent(mensaje)}`;
}

/** Quita saltos de línea y espacios de sobra de lo que escribe el cliente. */
function limpiar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

export interface DatosReserva {
  negocio: string;
  barbero: string;
  servicio: string;
  precio: number;
  duracionMin: number;
  fecha: string;
  hora: string;
  cliente: string;
  nota?: string;
  formaDePago: string;
  /** Código de la reserva guardada en la base de datos. Si falta, se pide confirmación. */
  codigo?: string;
  /** Link a /cancelar con el código: así el cliente lo tiene guardado en su chat. */
  enlaceCancelar?: string;
}

export function mensajeReserva(r: DatosReserva): string {
  const nota = r.nota ? limpiar(r.nota) : '';
  const lineas = [
    r.codigo
      ? `Hola ${r.barbero}, reservé en ${r.negocio}:`
      : `Hola ${r.barbero}, quiero reservar en ${r.negocio}:`,
    '',
    `✂️ ${r.servicio} · ${formatoBs(r.precio)} · ${duracion(r.duracionMin)}`,
    `📅 ${fechaLarga(r.fecha)}`,
    `🕐 ${hora12(r.hora)}`,
    `👤 ${limpiar(r.cliente)}`,
  ];
  if (nota) lineas.push(`📝 ${nota}`);
  if (r.codigo) lineas.push(`🔖 Reserva ${r.codigo}`);
  if (r.codigo && r.enlaceCancelar) lineas.push(`❌ Para cancelar: ${r.enlaceCancelar}`);
  lineas.push(
    '',
    r.codigo ? `${r.formaDePago} ¡Nos vemos!` : `${r.formaDePago} ¿Me confirmas la hora?`,
  );
  return lineas.join('\n');
}

export interface LineaPedido {
  nombre: string;
  cantidad: number;
  /** undefined = precio a consultar. */
  precio?: number;
}

export function mensajePedido(p: {
  negocio: string;
  lineas: LineaPedido[];
  cliente?: string;
  formaDePago: string;
}): string {
  const conPrecio = p.lineas.every((l) => l.precio !== undefined);
  const total = p.lineas.reduce((suma, l) => suma + l.cantidad * (l.precio ?? 0), 0);
  const cliente = p.cliente ? limpiar(p.cliente) : '';
  const lineas = [
    `Hola ${p.negocio}, quiero hacer este pedido:`,
    '',
    ...p.lineas.map((l) =>
      l.precio === undefined
        ? `• ${l.cantidad} × ${l.nombre}`
        : `• ${l.cantidad} × ${l.nombre} · ${formatoBs(l.cantidad * l.precio)}`,
    ),
    '',
    conPrecio ? `Total: ${formatoBs(total)}` : '¿Me confirmas el precio y si lo tienen?',
  ];
  if (cliente) lineas.push(`A nombre de: ${cliente}`);
  lineas.push('', `Paso a recogerlo. ${p.formaDePago}`);
  return lineas.join('\n');
}
