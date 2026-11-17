import { describe, expect, it } from 'vitest';
import {
  agregar,
  cambiarCantidad,
  CLAVE_ALMACEN,
  guardarCarrito,
  leerCarrito,
  lineasDe,
  MAX_POR_PRODUCTO,
  quitar,
  totalDe,
  unidadesDe,
} from '../../src/lib/carrito';

const catalogo = [
  { id: 'cera', nombre: 'Cera', precio: 60, disponible: true },
  { id: 'aceite', nombre: 'Aceite', precio: 70, disponible: true },
  { id: 'peine', nombre: 'Peine', precio: 25, disponible: false },
];

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
}

describe('carrito', () => {
  it('agrega, cambia y quita sin modificar el original', () => {
    const vacio = {};
    const uno = agregar(vacio, 'cera');
    expect(vacio).toEqual({});
    expect(agregar(uno, 'cera', 2)).toEqual({ cera: 3 });
    expect(cambiarCantidad(uno, 'cera', 0)).toEqual({});
    expect(quitar({ cera: 2, aceite: 1 }, 'cera')).toEqual({ aceite: 1 });
  });

  it('no pasa del máximo ni acepta negativos', () => {
    expect(agregar({}, 'cera', 999)).toEqual({ cera: MAX_POR_PRODUCTO });
    expect(cambiarCantidad({ cera: 2 }, 'cera', -5)).toEqual({});
  });

  it('calcula líneas y total ignorando agotados o inexistentes', () => {
    const lineas = lineasDe({ cera: 2, aceite: 1, peine: 3, borrado: 1 }, catalogo);
    expect(lineas.map((l) => l.producto.id)).toEqual(['cera', 'aceite']);
    expect(totalDe(lineas)).toBe(190);
    expect(unidadesDe(lineas)).toBe(3);
  });

  it('si un producto no tiene precio, el total queda a confirmar', () => {
    const conConsulta = [...catalogo, { id: 'minoxidil', nombre: 'Minoxidil', disponible: true }];
    const lineas = lineasDe({ cera: 1, minoxidil: 2 }, conConsulta);
    expect(lineas.map((l) => l.subtotal)).toEqual([60, null]);
    expect(totalDe(lineas)).toBeNull();
    expect(unidadesDe(lineas)).toBe(3);
  });

  it('guarda y recupera del almacenamiento', () => {
    const almacen = almacenFalso();
    guardarCarrito(almacen, { cera: 2 });
    expect(leerCarrito(almacen)).toEqual({ cera: 2 });
  });

  it('ignora datos dañados o bloqueados', () => {
    expect(leerCarrito(almacenFalso({ [CLAVE_ALMACEN]: '{no es json' }))).toEqual({});
    expect(leerCarrito(almacenFalso({ [CLAVE_ALMACEN]: '[1,2]' }))).toEqual({});
    expect(
      leerCarrito(almacenFalso({ [CLAVE_ALMACEN]: '{"cera":"dos","aceite":-1,"x":3.7}' })),
    ).toEqual({ x: 3 });
    expect(leerCarrito(undefined)).toEqual({});
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(leerCarrito(roto)).toEqual({});
  });
});
