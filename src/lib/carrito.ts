/**
 * Carrito de la tienda. Funciones puras: reciben un carrito y devuelven uno nuevo.
 * El carrito se guarda en el celular del cliente para que no se pierda si cierra la página.
 */

/** id del producto → cantidad */
export type Carrito = Readonly<Record<string, number>>;

export const MAX_POR_PRODUCTO = 20;
export const CLAVE_ALMACEN = 'mbk-carrito-v1';

export interface ProductoCarrito {
  id: string;
  nombre: string;
  /** undefined = precio a consultar. */
  precio?: number;
  disponible: boolean;
}

export interface LineaCarrito<P extends ProductoCarrito = ProductoCarrito> {
  producto: P;
  cantidad: number;
  /** null si el producto no tiene precio publicado. */
  subtotal: number | null;
}

const acotar = (n: number) => Math.max(0, Math.min(MAX_POR_PRODUCTO, Math.trunc(n)));

export function cambiarCantidad(carrito: Carrito, id: string, cantidad: number): Carrito {
  const q = acotar(cantidad);
  const nuevo: Record<string, number> = { ...carrito };
  if (q === 0) delete nuevo[id];
  else nuevo[id] = q;
  return nuevo;
}

export function agregar(carrito: Carrito, id: string, cantidad = 1): Carrito {
  return cambiarCantidad(carrito, id, (carrito[id] ?? 0) + cantidad);
}

export function quitar(carrito: Carrito, id: string): Carrito {
  return cambiarCantidad(carrito, id, 0);
}

/** Líneas del carrito en el orden del catálogo. Ignora productos que ya no existen o se agotaron. */
export function lineasDe<P extends ProductoCarrito>(
  carrito: Carrito,
  catalogo: P[],
): LineaCarrito<P>[] {
  return catalogo
    .filter((p) => p.disponible && (carrito[p.id] ?? 0) > 0)
    .map((p) => {
      const cantidad = carrito[p.id] ?? 0;
      return {
        producto: p,
        cantidad,
        subtotal: p.precio === undefined ? null : cantidad * p.precio,
      };
    });
}

/** Total del pedido, o null si algún producto no tiene precio (se confirma por WhatsApp). */
export function totalDe(lineas: LineaCarrito[]): number | null {
  let total = 0;
  for (const l of lineas) {
    if (l.subtotal === null) return null;
    total += l.subtotal;
  }
  return total;
}

export function unidadesDe(lineas: LineaCarrito[]): number {
  return lineas.reduce((suma, l) => suma + l.cantidad, 0);
}

/** Lee el carrito guardado. Si no hay, está dañado o el navegador lo bloquea, devuelve uno vacío. */
export function leerCarrito(almacen: Pick<Storage, 'getItem'> | undefined): Carrito {
  try {
    const crudo = almacen?.getItem(CLAVE_ALMACEN);
    if (!crudo) return {};
    const datos: unknown = JSON.parse(crudo);
    if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) return {};
    let carrito: Carrito = {};
    for (const [id, cantidad] of Object.entries(datos)) {
      if (typeof cantidad === 'number' && Number.isFinite(cantidad)) {
        carrito = cambiarCantidad(carrito, id, cantidad);
      }
    }
    return carrito;
  } catch {
    return {};
  }
}

export function guardarCarrito(
  almacen: Pick<Storage, 'setItem'> | undefined,
  carrito: Carrito,
): void {
  try {
    almacen?.setItem(CLAVE_ALMACEN, JSON.stringify(carrito));
  } catch {
    // Modo incógnito o almacenamiento lleno: el carrito sigue funcionando mientras la página esté abierta.
  }
}
