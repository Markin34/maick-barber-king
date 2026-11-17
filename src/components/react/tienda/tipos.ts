import type { ImagenWeb } from '../../../lib/imagenes';

export interface ProductoVista {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  /** undefined = precio a consultar. */
  precio?: number;
  disponible: boolean;
  imagen?: ImagenWeb;
}

export interface NegocioTienda {
  nombre: string;
  whatsapp: string;
  formaDePago: string;
}
