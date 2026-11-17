/**
 * Cálculo de días y horas que se pueden reservar.
 *
 * Las horas salen del horario de atención. Si hay datos de Supabase, las que se cruzan con una
 * reserva o un bloqueo se marcan como ocupadas.
 */
import { DIAS } from '../data/dias';
import type { Barbero, HorarioDia, Negocio, Servicio } from '../data/schema';
import { aHora, aMinutos, ahoraEn, diaDeSemana, sumarDias, type Ahora } from './tiempo';

type ReglasNegocio = Pick<
  Negocio,
  'horario' | 'intervaloMin' | 'diasAnticipacion' | 'minutosMinimos'
> &
  Partial<Pick<Negocio, 'ultimaReservaAntesDelCierre'>>;
type HorarioBarbero = Pick<Barbero, 'horario'>;

/** Tramo ocupado dentro de un día, en minutos desde la medianoche: [desde, hasta). */
export type Tramo = readonly [number, number];
/** Tramos ocupados por fecha "AAAA-MM-DD". */
export type OcupadosPorFecha = ReadonlyMap<string, readonly Tramo[]>;

export interface Hora {
  hora: string;
  libre: boolean;
}

/** Horario de un barbero en una fecha: el suyo si lo tiene, si no el de la barbería. */
export function horarioDelDia(
  negocio: Pick<Negocio, 'horario'>,
  barbero: HorarioBarbero,
  fecha: string,
): HorarioDia | null {
  const dia = DIAS[diaDeSemana(fecha)];
  if (!dia) return null;
  const propio = barbero.horario?.[dia];
  return propio === undefined ? negocio.horario[dia] : propio;
}

/**
 * Todas las horas de inicio del día, desde que abre hasta la última reserva
 * (cierre menos `ultimaReservaAntesDelCierre`; con 20:30 y 30 → 20:00), marcando cuáles están
 * ocupadas. La última hora es la misma para todos los servicios, aunque terminen después.
 */
export function horasDelDia(params: {
  negocio: ReglasNegocio;
  barbero: HorarioBarbero;
  servicio: Pick<Servicio, 'duracionMin'>;
  fecha: string;
  ahora: Ahora;
  ocupados?: OcupadosPorFecha;
}): Hora[] {
  const { negocio, barbero, servicio, fecha, ahora, ocupados } = params;
  if (fecha < ahora.fecha) return [];
  const horario = horarioDelDia(negocio, barbero, fecha);
  if (!horario) return [];

  const abre = aMinutos(horario.abre);
  const cierra = aMinutos(horario.cierra);
  const duracion = servicio.duracionMin;
  const primeraPosible = fecha === ahora.fecha ? ahora.minutos + negocio.minutosMinimos : -Infinity;
  const descanso = horario.descanso
    ? { desde: aMinutos(horario.descanso.desde), hasta: aMinutos(horario.descanso.hasta) }
    : null;
  const tramos = ocupados?.get(fecha) ?? [];

  const horas: Hora[] = [];
  const ultima = cierra - (negocio.ultimaReservaAntesDelCierre ?? 0);
  for (let inicio = abre; inicio <= ultima; inicio += negocio.intervaloMin) {
    if (inicio < primeraPosible) continue;
    const fin = inicio + duracion;
    if (descanso && inicio < descanso.hasta && fin > descanso.desde) continue;
    const libre = !tramos.some(([desde, hasta]) => inicio < hasta && fin > desde);
    horas.push({ hora: aHora(inicio), libre });
  }
  return horas;
}

/** Solo las horas libres ("HH:MM"). */
export function horasDisponibles(params: Parameters<typeof horasDelDia>[0]): string[] {
  return horasDelDia(params)
    .filter((h) => h.libre)
    .map((h) => h.hora);
}

/** Fechas desde hoy (incluido) en las que queda al menos una hora libre para ese servicio. */
export function diasDisponibles(params: {
  negocio: ReglasNegocio;
  barbero: HorarioBarbero;
  servicio: Pick<Servicio, 'duracionMin'>;
  ahora: Ahora;
  ocupados?: OcupadosPorFecha;
}): string[] {
  const { negocio, ahora } = params;
  const dias: string[] = [];
  for (let i = 0; i < negocio.diasAnticipacion; i++) {
    const fecha = sumarDias(ahora.fecha, i);
    if (horasDisponibles({ ...params, fecha }).length > 0) dias.push(fecha);
  }
  return dias;
}

/** Primera hora libre de un barbero desde ahora, o null si no tiene en los días que se reservan. */
export function proximaHoraLibre(params: {
  negocio: ReglasNegocio;
  barbero: HorarioBarbero;
  servicio: Pick<Servicio, 'duracionMin'>;
  ahora: Ahora;
  ocupados?: OcupadosPorFecha;
}): { fecha: string; hora: string } | null {
  for (let i = 0; i < params.negocio.diasAnticipacion; i++) {
    const fecha = sumarDias(params.ahora.fecha, i);
    const [hora] = horasDisponibles({ ...params, fecha });
    if (hora) return { fecha, hora };
  }
  return null;
}

/**
 * Convierte intervalos de la base de datos (fechas ISO con zona) en tramos por día,
 * en la hora local de la barbería. Un intervalo que pasa la medianoche se reparte en dos días.
 */
export function agruparOcupados(
  intervalos: readonly { inicio: string; fin: string }[],
  zonaHoraria: string,
): OcupadosPorFecha {
  const mapa = new Map<string, Tramo[]>();
  const agregar = (fecha: string, tramo: Tramo) => {
    const lista = mapa.get(fecha) ?? [];
    lista.push(tramo);
    mapa.set(fecha, lista);
  };
  for (const { inicio, fin } of intervalos) {
    const desde = new Date(inicio);
    const hasta = new Date(fin);
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || hasta <= desde) continue;
    const a = ahoraEn(zonaHoraria, desde);
    const b = ahoraEn(zonaHoraria, hasta);
    if (a.fecha === b.fecha) {
      agregar(a.fecha, [a.minutos, b.minutos]);
      continue;
    }
    agregar(a.fecha, [a.minutos, 24 * 60]);
    for (let f = sumarDias(a.fecha, 1); f < b.fecha; f = sumarDias(f, 1)) agregar(f, [0, 24 * 60]);
    if (b.minutos > 0) agregar(b.fecha, [0, b.minutos]);
  }
  return mapa;
}
