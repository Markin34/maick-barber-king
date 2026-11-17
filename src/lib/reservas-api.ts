/**
 * Conexión con Supabase usando fetch directo a sus funciones (sin la librería oficial),
 * para que la página siga pesando poco.
 *
 * La clave pública solo puede llamar a `horarios_ocupados` y `crear_reserva`
 * (ver supabase/migrations/0001_reservas.sql).
 */

export interface ConfigSupabase {
  url: string;
  clave: string;
}

export type CodigoError =
  | 'HORA_OCUPADA'
  | 'HORA_PASADA'
  | 'MUY_LEJOS'
  | 'DATOS_INVALIDOS'
  | 'DEMASIADAS_RESERVAS'
  | 'FUERA_DE_HORARIO'
  | 'SIN_CATALOGO'
  | 'SIN_CONEXION'
  | 'DESCONOCIDO';

const CODIGOS_SERVIDOR: readonly CodigoError[] = [
  'HORA_OCUPADA',
  'HORA_PASADA',
  'MUY_LEJOS',
  'DATOS_INVALIDOS',
  'DEMASIADAS_RESERVAS',
  'FUERA_DE_HORARIO',
  'SIN_CATALOGO',
];

export const MENSAJE_ERROR: Record<CodigoError, string> = {
  HORA_OCUPADA: 'Alguien acaba de reservar esa hora. Elige otra.',
  HORA_PASADA: 'Esa hora ya pasó o está muy cerca. Elige una más tarde.',
  MUY_LEJOS: 'Esa fecha está muy lejos. Elige un día más cercano.',
  DATOS_INVALIDOS: 'Revisa tu nombre y la nota, y vuelve a intentar.',
  DEMASIADAS_RESERVAS:
    'Ya tienes varias reservas a tu nombre. Escríbenos por WhatsApp si necesitas otra.',
  FUERA_DE_HORARIO: 'Esa hora ya no se puede reservar. Elige otra.',
  SIN_CATALOGO: 'No pudimos guardar tu reserva. Envíala por WhatsApp y te confirmamos.',
  SIN_CONEXION: 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.',
  DESCONOCIDO: 'Algo salió mal al guardar tu reserva. Intenta de nuevo.',
};

export class ErrorReserva extends Error {
  override name = 'ErrorReserva';
  constructor(readonly codigo: CodigoError) {
    super(MENSAJE_ERROR[codigo]);
  }
}

const ESPERA_MAXIMA_MS = 12_000;

async function llamar<T>(
  config: ConfigSupabase,
  funcion: string,
  parametros: Record<string, unknown>,
  senal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: config.clave,
  };
  // Las claves antiguas (anon, formato JWT) también necesitan Authorization.
  if (config.clave.startsWith('eyJ')) headers.Authorization = `Bearer ${config.clave}`;

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);
  const cancelar = () => control.abort();
  senal?.addEventListener('abort', cancelar, { once: true });

  let respuesta: Response;
  try {
    respuesta = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/${funcion}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(parametros),
      signal: control.signal,
    });
  } catch (e) {
    if (senal?.aborted) throw e;
    throw new ErrorReserva('SIN_CONEXION');
  } finally {
    clearTimeout(reloj);
    senal?.removeEventListener('abort', cancelar);
  }

  if (!respuesta.ok) {
    let mensaje = '';
    try {
      mensaje = String(((await respuesta.json()) as { message?: unknown }).message ?? '');
    } catch {
      // Respuesta sin JSON: lo tratamos como error desconocido.
    }
    const codigo = CODIGOS_SERVIDOR.find((c) => mensaje.includes(c));
    throw new ErrorReserva(codigo ?? (respuesta.status >= 500 ? 'SIN_CONEXION' : 'DESCONOCIDO'));
  }
  return (await respuesta.json()) as T;
}

export interface Intervalo {
  inicio: string;
  fin: string;
}

/** Horas tomadas (reservas y bloqueos) de un barbero entre dos fechas, ambas incluidas. */
export function obtenerOcupados(
  config: ConfigSupabase,
  barbero: string,
  desde: string,
  hasta: string,
  senal?: AbortSignal,
): Promise<Intervalo[]> {
  return llamar<Intervalo[]>(
    config,
    'horarios_ocupados',
    { p_barbero: barbero, p_desde: desde, p_hasta: hasta },
    senal,
  );
}

export interface NuevaReserva {
  barbero: string;
  servicio: string;
  fecha: string;
  hora: string;
  duracionMin: number;
  cliente: string;
  nota?: string;
}

/** Guarda la reserva. Si la hora ya no está libre lanza ErrorReserva('HORA_OCUPADA'). */
export async function crearReserva(
  config: ConfigSupabase,
  r: NuevaReserva,
): Promise<{ id: string; codigo: string }> {
  const filas = await llamar<{ id: string; codigo: string }[]>(config, 'crear_reserva', {
    p_barbero: r.barbero,
    p_servicio: r.servicio,
    p_fecha: r.fecha,
    p_hora: r.hora,
    p_duracion_min: r.duracionMin,
    p_cliente: r.cliente.trim(),
    p_nota: r.nota?.trim() || null,
  });
  const fila = filas[0];
  if (!fila) throw new ErrorReserva('DESCONOCIDO');
  return fila;
}

export type ResultadoCancelacion =
  | 'CANCELADA'
  | 'NO_ENCONTRADA'
  | 'MUY_TARDE'
  | 'DEMASIADOS_INTENTOS';

const RESULTADOS_CANCELACION: readonly ResultadoCancelacion[] = [
  'CANCELADA',
  'NO_ENCONTRADA',
  'MUY_TARDE',
  'DEMASIADOS_INTENTOS',
];

/** El cliente cancela su cita con el código y el nombre con que reservó. */
export async function cancelarReserva(
  config: ConfigSupabase,
  codigo: string,
  cliente: string,
): Promise<ResultadoCancelacion> {
  const r = await llamar<unknown>(config, 'cancelar_reserva', {
    p_codigo: codigo.trim().toUpperCase(),
    p_cliente: cliente.trim(),
  });
  if (typeof r === 'string' && RESULTADOS_CANCELACION.includes(r as ResultadoCancelacion)) {
    return r as ResultadoCancelacion;
  }
  throw new ErrorReserva('DESCONOCIDO');
}

/** Anota un error inesperado en Supabase (tabla errores_web). Nunca lanza. */
export async function registrarError(
  config: ConfigSupabase,
  error: { mensaje: string; pagina?: string; detalle?: string },
): Promise<void> {
  try {
    await llamar(config, 'registrar_error', {
      p_mensaje: error.mensaje.slice(0, 300),
      p_pagina: error.pagina?.slice(0, 200) ?? null,
      p_detalle: error.detalle?.slice(0, 2000) ?? null,
    });
  } catch {
    // Si ni siquiera se puede avisar del error, no hay nada más que hacer.
  }
}
