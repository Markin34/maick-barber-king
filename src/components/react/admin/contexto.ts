import { createContext, use } from 'react';
import type { DatosAdmin } from './hooks';
import type { ListaNegra } from './listaNegra';

export interface BarberoPanel {
  id: string;
  apodo: string;
  /** WhatsApp propio del barbero; vacío si usa el de la barbería (entonces no hay botón de aviso). */
  whatsapp: string;
  /** Nombres de los servicios que hace. */
  servicios: string[];
  /** Días de la semana (0 = domingo) en que no trabaja. */
  diasLibres?: number[];
}

export interface ServicioPanel {
  nombre: string;
  precio: number;
  duracionMin: number;
}

export interface ContextoPanel {
  zona: string;
  negocio: string;
  barberos: BarberoPanel[];
  servicios: ServicioPanel[];
  precioDe: (servicio: string) => number;
  apodoDe: (barbero: string | null) => string;
  datos: DatosAdmin;
  listaNegra: ListaNegra;
  avisar: (mensaje: string) => void;
}

export const Panel = createContext<ContextoPanel | null>(null);

/** Datos y acciones del panel para cualquier componente dentro del tablero. */
export function usePanel(): ContextoPanel {
  const valor = use(Panel);
  if (!valor) throw new Error('usePanel debe usarse dentro de <Panel.Provider>');
  return valor;
}
