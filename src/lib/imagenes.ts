import type { ImageMetadata } from 'astro';

const archivos = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

/** Busca una imagen de src/assets a partir de la ruta escrita en src/data. */
export function imagen(ruta: string | undefined): ImageMetadata | undefined {
  if (!ruta) return undefined;
  const encontrada = archivos[`/src/assets/${ruta}`];
  if (!encontrada) {
    throw new Error(
      `No encuentro la imagen "src/assets/${ruta}". Revisa el nombre del archivo en src/data.`,
    );
  }
  return encontrada.default;
}

export { iniciales } from './texto';

export interface ImagenWeb {
  src: string;
  srcSet: string;
  ancho: number;
  alto: number;
}
