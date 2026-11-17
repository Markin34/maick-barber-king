import type { Barbero } from '../../../data/schema';
import type { ImagenWeb } from '../../../lib/imagenes';

/** Barbero con lo que necesita la pantalla, ya resuelto al construir la página. */
export interface BarberoVista extends Barbero {
  /** Retrato optimizado, o undefined para mostrar iniciales. */
  fotoUrl?: string;
  /** Foto de un trabajo suyo, para el fondo de su tarjeta. */
  trabajoImg?: ImagenWeb;
  /** Retrato grande, para arriba de su tarjeta cuando no hay foto de trabajo. */
  retratoImg?: ImagenWeb;
  /** ids de los servicios que hace. */
  serviciosIds: string[];
}
