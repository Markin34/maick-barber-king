/**
 * Catálogo con carrito. El pedido se envía por WhatsApp y se paga al recogerlo en la barbería.
 */
import { AnimatePresence, m } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';
import { cambiarCantidad, lineasDe, totalDe, unidadesDe } from '../../../lib/carrito';
import { formatoBs } from '../../../lib/formato';
import { linkWhatsApp, mensajePedido } from '../../../lib/whatsapp';
import { Movimiento } from '../comun/Movimiento';
import { TOQUE } from '../comun/animaciones';
import { PanelPedido } from './PanelPedido';
import { TarjetaProducto } from './TarjetaProducto';
import type { NegocioTienda, ProductoVista } from './tipos';
import { useCarrito } from './useCarrito';

interface Props {
  negocio: NegocioTienda;
  productos: ProductoVista[];
}

function TiendaInterna({ negocio, productos }: Props) {
  const [carrito, actualizar] = useCarrito();
  const [abierto, setAbierto] = useState(false);
  const [cliente, setCliente] = useState('');

  const lineas = useMemo(() => lineasDe(carrito, productos), [carrito, productos]);
  const total = totalDe(lineas);
  const unidades = unidadesDe(lineas);
  const enlace =
    lineas.length > 0
      ? linkWhatsApp(
          negocio.whatsapp,
          mensajePedido({
            negocio: negocio.nombre,
            lineas: lineas.map((l) => ({
              nombre: l.producto.nombre,
              cantidad: l.cantidad,
              precio: l.producto.precio,
            })),
            cliente,
            formaDePago: negocio.formaDePago,
          }),
        )
      : undefined;

  const cambiar = useCallback(
    (id: string, cantidad: number) => actualizar((c) => cambiarCantidad(c, id, cantidad)),
    [actualizar],
  );
  const cerrar = useCallback(() => setAbierto(false), []);

  return (
    <>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
        {productos.map((p, i) => (
          <TarjetaProducto
            key={p.id}
            producto={p}
            cantidad={carrito[p.id] ?? 0}
            prioridad={i < 4}
            onCambiar={cambiar}
          />
        ))}
      </ul>

      {/* Barra del carrito: sube cuando hay algo en el pedido. */}
      <AnimatePresence>
        {unidades > 0 && !abierto && (
          <m.div
            className="border-borde bg-fondo/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
          >
            <div className="contenedor flex items-center justify-between gap-4 pt-3">
              <span className="text-sm">
                <m.b
                  key={unidades}
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  className="inline-block tabular-nums"
                >
                  {unidades}
                </m.b>{' '}
                {unidades === 1 ? 'producto' : 'productos'}
                {total !== null && (
                  <>
                    {' · '}
                    <b className="text-laton">{formatoBs(total)}</b>
                  </>
                )}
              </span>
              <m.button
                type="button"
                className="btn-principal"
                whileTap={TOQUE}
                onClick={() => setAbierto(true)}
              >
                Ver pedido
              </m.button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <div className="h-24" aria-hidden="true" />

      <AnimatePresence>
        {abierto && (
          <PanelPedido
            lineas={lineas}
            total={total}
            cliente={cliente}
            enlace={enlace}
            formaDePago={negocio.formaDePago}
            onCliente={setCliente}
            onQuitar={(id) => cambiar(id, 0)}
            onCerrar={cerrar}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function Tienda(props: Props) {
  return (
    <Movimiento>
      <TiendaInterna {...props} />
    </Movimiento>
  );
}
