import { m } from 'motion/react';
import { useEffect, useId, useRef } from 'react';
import type { LineaCarrito } from '../../../lib/carrito';
import { formatoBs } from '../../../lib/formato';
import { IconoWhatsApp } from '../comun/Iconos';
import { TOQUE } from '../comun/animaciones';
import type { ProductoVista } from './tipos';

interface Props {
  lineas: LineaCarrito<ProductoVista>[];
  /** null si hay productos sin precio publicado. */
  total: number | null;
  cliente: string;
  enlace?: string;
  formaDePago: string;
  onCliente: (valor: string) => void;
  onQuitar: (id: string) => void;
  onCerrar: () => void;
}

/**
 * Hoja que sube desde abajo con el pedido.
 * Accesible: es un diálogo modal, Esc lo cierra, el foco entra al abrir y vuelve al botón al cerrar.
 */
export function PanelPedido(p: Props) {
  const idTitulo = useId();
  const idNombre = useId();
  const panel = useRef<HTMLDivElement>(null);
  const { onCerrar } = p;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const desborde = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('button, a, input')?.focus();
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = desborde;
      window.removeEventListener('keydown', tecla);
      anterior?.focus();
    };
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <m.div
        className="absolute inset-0 bg-black/40"
        onClick={onCerrar}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-hidden="true"
      />
      <m.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="bg-fondo relative flex max-h-[85dvh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      >
        <span
          className="bg-borde mx-auto -mt-1 h-1 w-10 rounded-full sm:hidden"
          aria-hidden="true"
        />
        <div className="flex items-center justify-between">
          <h2 id={idTitulo} className="font-display text-2xl">
            Tu pedido
          </h2>
          <button
            type="button"
            className="text-gris hover:text-texto rounded-lg px-2 py-1 text-sm"
            onClick={onCerrar}
          >
            Cerrar
          </button>
        </div>

        {p.lineas.length === 0 ? (
          <p className="text-gris">Tu pedido está vacío.</p>
        ) : (
          <>
            <ul className="divide-borde divide-y text-sm">
              {p.lineas.map((l) => (
                <m.li
                  layout
                  key={l.producto.id}
                  className="flex items-center justify-between gap-3 py-3"
                  exit={{ opacity: 0, x: 24 }}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {l.producto.imagen && (
                      <img
                        src={l.producto.imagen.src}
                        alt=""
                        className="size-12 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block font-semibold">{l.producto.nombre}</span>
                      <span className="text-gris">
                        {l.cantidad} ×{' '}
                        {l.producto.precio === undefined
                          ? 'precio a consultar'
                          : formatoBs(l.producto.precio)}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {l.subtotal !== null && <b className="tabular-nums">{formatoBs(l.subtotal)}</b>}
                    <button
                      type="button"
                      className="text-gris hover:text-rojo text-xs underline"
                      onClick={() => p.onQuitar(l.producto.id)}
                    >
                      Quitar
                    </button>
                  </span>
                </m.li>
              ))}
            </ul>
            {p.total === null ? (
              <p className="bg-panel-2 rounded-xl px-4 py-3 text-sm">
                Te confirmamos el precio por WhatsApp.
              </p>
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-gris">Total</span>
                <m.span
                  key={p.total}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  className="font-display text-laton text-2xl"
                >
                  {formatoBs(p.total)}
                </m.span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor={idNombre} className="text-sm font-semibold">
                Tu nombre <span className="text-gris font-normal">(opcional)</span>
              </label>
              <input
                id={idNombre}
                type="text"
                autoComplete="name"
                maxLength={60}
                value={p.cliente}
                onChange={(e) => p.onCliente(e.target.value)}
                className="bg-panel border-borde focus:border-laton min-h-12 rounded-xl border px-4 text-base outline-none"
                placeholder="Para tener listo tu pedido"
              />
            </div>
            <m.a
              href={p.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-wa w-full"
              whileTap={TOQUE}
            >
              <IconoWhatsApp />
              Enviar pedido por WhatsApp
            </m.a>
            <p className="text-gris text-center text-xs">
              Lo recoges en la barbería. {p.formaDePago}
            </p>
          </>
        )}
      </m.div>
    </div>
  );
}
