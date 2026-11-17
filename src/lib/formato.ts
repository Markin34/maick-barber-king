import { aMinutos, fechaParaFormato } from './tiempo';

const miles = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });
const fechaLargaFmt = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const diaCortoFmt = new Intl.DateTimeFormat('es-BO', { weekday: 'short', timeZone: 'UTC' });
const mesCortoFmt = new Intl.DateTimeFormat('es-BO', { month: 'short', timeZone: 'UTC' });

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const sinPunto = (t: string) => t.replace(/\.$/, '');

/** 1250 → "Bs 1.250" */
export function formatoBs(monto: number): string {
  return `Bs ${miles.format(monto)}`;
}

/** "2026-11-14" → "Sábado 14 de noviembre" */
export function fechaLarga(fecha: string): string {
  return capitalizar(fechaLargaFmt.format(fechaParaFormato(fecha)).replace(',', ''));
}

/** "2026-11-14" → { dia: "Sáb", numero: "14", mes: "nov" } */
export function fechaCorta(fecha: string): { dia: string; numero: string; mes: string } {
  const f = fechaParaFormato(fecha);
  return {
    dia: capitalizar(sinPunto(diaCortoFmt.format(f))),
    numero: String(f.getUTCDate()),
    mes: sinPunto(mesCortoFmt.format(f)),
  };
}

/** "16:30" → "4:30 pm" */
export function hora12(hora: string): string {
  const total = aMinutos(hora);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** 90 → "1 h 30 min" */
export function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
