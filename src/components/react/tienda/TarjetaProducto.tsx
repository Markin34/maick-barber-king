import { AnimatePresence, m } from 'motion/react';
import { memo } from 'react';
import { MAX_POR_PRODUCTO } from '../../../lib/carrito';
import { formatoBs } from '../../../lib/formato';
import { TOQUE } from '../comun/animaciones';
import type { ProductoVista } from './tipos';

interface Props {
  producto: ProductoVista;
  cantidad: number;
  /** Las primeras fotos se cargan de inmediato; el resto, al acercarse a la pantalla. */
  prioridad: boolean;
  onCambiar: (id: string, cantidad: number) => void;
}

/** memo: al cambiar la cantidad de un producto, solo se vuelve a dibujar esa tarjeta. */
export const TarjetaProducto = memo(function TarjetaProducto({
  producto: p,
  cantidad,
  prioridad,
  onCambiar,
}: Props) {
  return (
    // La entrada al hacer scroll es solo CSS (clase "revelar"): la tienda se ve completa aunque el JS tarde.
    <li className="revelar group flex flex-col">
      <div className="bg-panel-2 relative aspect-[4/5] overflow-hidden rounded-2xl">
        {p.imagen ? (
          <img
            src={p.imagen.src}
            srcSet={p.imagen.srcSet}
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 33vw, 50vw"
            alt={p.nombre}
            width={p.imagen.ancho}
            height={p.imagen.alto}
            loading={prioridad ? 'eager' : 'lazy'}
            decoding="async"
            className={`size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${p.disponible ? '' : 'grayscale'}`}
          />
        ) : (
          <span
            className="font-display text-laton/30 grid size-full place-items-center text-6xl"
            aria-hidden="true"
          >
            {p.nombre.charAt(0)}
          </span>
        )}
        {/* Etiquetas en una fila que se acomoda sola: "Agotado" nunca tapa la categoría. */}
        <span className="absolute inset-x-2 top-2 flex flex-wrap gap-1.5">
          <span className="bg-fondo/90 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase">
            {p.categoria}
          </span>
          {!p.disponible && (
            <span className="bg-texto/85 rounded-full px-2.5 py-1 text-[11px] font-bold text-white">
              Agotado
            </span>
          )}
        </span>
        <AnimatePresence>
          {cantidad > 0 && (
            <m.span
              key="en-pedido"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="bg-laton text-fondo absolute right-2 bottom-2 grid size-8 place-items-center rounded-full text-sm font-bold tabular-nums shadow-lg"
              aria-hidden="true"
            >
              {cantidad}
            </m.span>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-1 flex-col gap-1 pt-3">
        <h2 className="leading-snug font-semibold">{p.nombre}</h2>
        <p className="text-gris line-clamp-2 text-xs sm:text-sm">{p.descripcion}</p>
        {p.precio === undefined ? (
          <span className="text-gris mt-auto pt-1 text-sm font-semibold">Precio a consultar</span>
        ) : (
          <span className="font-display text-laton mt-auto pt-1 text-lg">
            {formatoBs(p.precio)}
          </span>
        )}
        {!p.disponible ? (
          <span className="text-gris mt-2 min-h-11 text-center text-sm leading-[2.75rem]">
            Sin stock por ahora
          </span>
        ) : cantidad === 0 ? (
          <m.button
            type="button"
            whileTap={TOQUE}
            className="btn-secundario mt-2 min-h-11 w-full text-sm"
            onClick={() => onCambiar(p.id, 1)}
          >
            Agregar
          </m.button>
        ) : (
          <div className="border-laton mt-2 flex min-h-11 items-center justify-between rounded-xl border">
            <m.button
              type="button"
              whileTap={{ scale: 0.85 }}
              className="size-11 text-lg font-bold"
              aria-label={`Quitar un ${p.nombre}`}
              onClick={() => onCambiar(p.id, cantidad - 1)}
            >
              −
            </m.button>
            <span className="font-bold tabular-nums" aria-live="polite">
              {cantidad}
            </span>
            <m.button
              type="button"
              whileTap={{ scale: 0.85 }}
              className="size-11 text-lg font-bold disabled:opacity-40"
              aria-label={`Agregar otro ${p.nombre}`}
              disabled={cantidad >= MAX_POR_PRODUCTO}
              onClick={() => onCambiar(p.id, cantidad + 1)}
            >
              +
            </m.button>
          </div>
        )}
      </div>
    </li>
  );
});
