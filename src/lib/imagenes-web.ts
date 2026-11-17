/**
 * Prepara fotos para las islas de React (que no pueden usar el componente <Image> de Astro).
 * Solo se usa al construir la página.
 */
import { getImage } from 'astro:assets';
import { imagen, type ImagenWeb } from './imagenes';

/** Versión WebP de la foto en varios anchos, para que cada celular baje solo el tamaño que necesita. */
export async function imagenWeb(
  ruta: string | undefined,
  anchos: readonly number[],
): Promise<ImagenWeb | undefined> {
  const meta = imagen(ruta);
  if (!meta) return undefined;
  const utiles = anchos.filter((a) => a <= meta.width);
  const lista = utiles.length > 0 ? utiles : [meta.width];
  const resultado = await getImage({ src: meta, widths: lista, format: 'webp' });
  return {
    src: resultado.src,
    srcSet: resultado.srcSet.attribute,
    ancho: meta.width,
    alto: meta.height,
  };
}
