/**
 * Utilidades de fechas y horas.
 *
 * Las fechas se manejan como texto "AAAA-MM-DD" y las horas como minutos desde la medianoche.
 * Así no dependemos de la zona horaria ni de la hora del celular del cliente.
 */

export interface Ahora {
  /** Fecha local de la barbería, "AAAA-MM-DD". */
  fecha: string;
  /** Minutos transcurridos desde la medianoche, hora local de la barbería. */
  minutos: number;
}

/** "09:30" → 570 */
export function aMinutos(hora: string): number {
  const [h = 0, m = 0] = hora.split(':').map(Number);
  return h * 60 + m;
}

/** 570 → "09:30" */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Fecha y hora actuales en la zona horaria de la barbería (por ejemplo "America/La_Paz"). */
export function ahoraEn(zonaHoraria: string, instante: Date = new Date()): Ahora {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '00';
  return {
    fecha: `${parte('year')}-${parte('month')}-${parte('day')}`,
    minutos: Number(parte('hour')) * 60 + Number(parte('minute')),
  };
}

function aFechaUTC(fecha: string): Date {
  const [a = 1970, m = 1, d = 1] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

/** sumarDias("2026-11-30", 1) → "2026-12-01" */
export function sumarDias(fecha: string, dias: number): string {
  const f = aFechaUTC(fecha);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/** 0 = domingo, 1 = lunes … 6 = sábado */
export function diaDeSemana(fecha: string): number {
  return aFechaUTC(fecha).getUTCDay();
}

/** Convierte una fecha "AAAA-MM-DD" en un Date a mediodía UTC, útil para formatear sin saltos de día. */
export function fechaParaFormato(fecha: string): Date {
  const f = aFechaUTC(fecha);
  f.setUTCHours(12);
  return f;
}
