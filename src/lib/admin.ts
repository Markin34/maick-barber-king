/**
 * Lógica del panel de administración, sin React: convertir, agrupar, buscar y resumir reservas.
 */
import { aHora, ahoraEn, sumarDias, diaDeSemana } from './tiempo';

export type EstadoReserva = 'confirmada' | 'cancelada' | 'asistio' | 'no_vino';

export const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  asistio: 'Asistió',
  no_vino: 'No vino',
};

/** Fila tal como llega de Supabase. */
export interface FilaReserva {
  id: string;
  codigo: string;
  barbero: string;
  servicio: string;
  inicio: string;
  fin: string;
  cliente: string;
  nota: string | null;
  estado: EstadoReserva;
  creada_en: string;
  /** 'web' = la reservó el cliente; 'manual' = corte anotado por el dueño en el panel. */
  origen?: 'web' | 'manual';
}

export interface FilaBloqueo {
  id: string;
  barbero: string | null;
  inicio: string;
  fin: string;
  motivo: string | null;
}

/** Reserva lista para mostrar, en hora de Bolivia. */
export interface Cita extends FilaReserva {
  fecha: string;
  hora: string;
  horaFin: string;
  minutos: number;
}

export function aCita(fila: FilaReserva, zona: string): Cita {
  const ini = ahoraEn(zona, new Date(fila.inicio));
  const fin = ahoraEn(zona, new Date(fila.fin));
  return {
    ...fila,
    fecha: ini.fecha,
    hora: aHora(ini.minutos),
    horaFin: aHora(fin.minutos),
    minutos: ini.minutos,
  };
}

export function ordenarCitas(citas: readonly Cita[]): Cita[] {
  return [...citas].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Citas de un día, agrupadas por barbero en el orden de la lista de barberos. */
export function citasPorBarbero(
  citas: readonly Cita[],
  fecha: string,
  barberos: readonly { id: string }[],
): Map<string, Cita[]> {
  const mapa = new Map<string, Cita[]>(barberos.map((b) => [b.id, []]));
  for (const c of ordenarCitas(citas)) {
    if (c.fecha !== fecha) continue;
    const lista = mapa.get(c.barbero) ?? [];
    lista.push(c);
    mapa.set(c.barbero, lista);
  }
  return mapa;
}

/** Cliente en la lista negra, tal como llega de Supabase. */
export interface FilaListaNegra {
  id: string;
  reserva_id: string | null;
  cliente: string;
  barbero: string | null;
  servicio: string | null;
  cita_inicio: string | null;
  motivo: string;
  penitencia: string | null;
  creado_en: string;
}

/** Nombre sin tildes, mayúsculas ni espacios de más: "  José  Pérez" → "jose perez". */
export const nombreClave = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Cuántas veces aparece cada cliente en la lista negra (por nombre normalizado). */
export function vecesEnListaNegra(lista: readonly FilaListaNegra[]): Map<string, number> {
  const veces = new Map<string, number>();
  for (const f of lista) {
    const k = nombreClave(f.cliente);
    veces.set(k, (veces.get(k) ?? 0) + 1);
  }
  return veces;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Busca por nombre de cliente (sin importar tildes ni mayúsculas) o por código. */
export function buscarCitas(citas: readonly Cita[], texto: string): Cita[] {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  return ordenarCitas(
    citas.filter((c) => normalizar(c.cliente).includes(q) || c.codigo.toLowerCase().startsWith(q)),
  ).reverse();
}

/** Lunes de la semana de una fecha. */
export function inicioDeSemana(fecha: string): string {
  const dia = diaDeSemana(fecha);
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

export interface Resumen {
  total: number;
  atendidas: number;
  pendientes: number;
  noVinieron: number;
  canceladas: number;
  /** Bs de citas que no se cancelaron ni faltaron. */
  ingresos: number;
  porBarbero: { id: string; citas: number; ingresos: number }[];
  porServicio: { nombre: string; citas: number }[];
}

export function resumir(
  citas: readonly Cita[],
  desde: string,
  hasta: string,
  precioDe: (servicio: string) => number,
): Resumen {
  const enRango = citas.filter((c) => c.fecha >= desde && c.fecha <= hasta);
  const validas = enRango.filter((c) => c.estado === 'confirmada' || c.estado === 'asistio');
  const porBarbero = new Map<string, { citas: number; ingresos: number }>();
  const porServicio = new Map<string, number>();
  for (const c of validas) {
    const b = porBarbero.get(c.barbero) ?? { citas: 0, ingresos: 0 };
    b.citas += 1;
    b.ingresos += precioDe(c.servicio);
    porBarbero.set(c.barbero, b);
    porServicio.set(c.servicio, (porServicio.get(c.servicio) ?? 0) + 1);
  }
  return {
    total: enRango.length,
    atendidas: enRango.filter((c) => c.estado === 'asistio').length,
    pendientes: enRango.filter((c) => c.estado === 'confirmada').length,
    noVinieron: enRango.filter((c) => c.estado === 'no_vino').length,
    canceladas: enRango.filter((c) => c.estado === 'cancelada').length,
    ingresos: validas.reduce((s, c) => s + precioDe(c.servicio), 0),
    porBarbero: [...porBarbero].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.citas - a.citas),
    porServicio: [...porServicio]
      .map(([nombre, citas]) => ({ nombre, citas }))
      .sort((a, b) => b.citas - a.citas),
  };
}

export interface CortesBarbero {
  id: string;
  /** Cortes hechos (asistió), de la página y anotados a mano. */
  cortes: number;
  /** De esos, cuántos se anotaron a mano. */
  manuales: number;
  ingresos: number;
}

/** Cortes hechos en un día por cada barbero, en el orden de la lista de barberos. */
export function cortesPorBarbero(
  citas: readonly Cita[],
  fecha: string,
  barberos: readonly { id: string }[],
  precioDe: (servicio: string) => number,
): CortesBarbero[] {
  const mapa = new Map<string, CortesBarbero>(
    barberos.map((b) => [b.id, { id: b.id, cortes: 0, manuales: 0, ingresos: 0 }]),
  );
  for (const c of citas) {
    if (c.fecha !== fecha || c.estado !== 'asistio') continue;
    const t = mapa.get(c.barbero) ?? { id: c.barbero, cortes: 0, manuales: 0, ingresos: 0 };
    t.cortes += 1;
    if (c.origen === 'manual') t.manuales += 1;
    t.ingresos += precioDe(c.servicio);
    mapa.set(c.barbero, t);
  }
  return [...mapa.values()];
}

/** "2026-11-14" + "13:00" en Bolivia → ISO con zona, para guardar un bloqueo. */
export function aInstante(fecha: string, hora: string): string {
  // Bolivia está en UTC-4 todo el año (sin horario de verano).
  return `${fecha}T${hora}:00-04:00`;
}
