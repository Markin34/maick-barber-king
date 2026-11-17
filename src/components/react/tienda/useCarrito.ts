/**
 * Carrito guardado en el celular, expuesto como un "store" externo (useSyncExternalStore):
 * - el build lo ve vacío y el navegador lo lee de localStorage, sin errores de hidratación;
 * - si el cliente tiene la tienda abierta en dos pestañas, ambas se mantienen iguales.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { CLAVE_ALMACEN, guardarCarrito, leerCarrito, type Carrito } from '../../../lib/carrito';

const VACIO: Carrito = Object.freeze({});
const oyentes = new Set<() => void>();
let actual: Carrito | null = null;

function almacen(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function leer(): Carrito {
  actual ??= leerCarrito(almacen());
  return actual;
}

function escribir(nuevo: Carrito): void {
  actual = nuevo;
  guardarCarrito(almacen(), nuevo);
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  const otraPestana = (ev: StorageEvent) => {
    if (ev.key !== CLAVE_ALMACEN) return;
    actual = null;
    avisar();
  };
  window.addEventListener('storage', otraPestana);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', otraPestana);
  };
}

export function useCarrito(): [Carrito, (cambio: (c: Carrito) => Carrito) => void] {
  const carrito = useSyncExternalStore(suscribir, leer, () => VACIO);
  const actualizar = useCallback((cambio: (c: Carrito) => Carrito) => escribir(cambio(leer())), []);
  return [carrito, actualizar];
}
