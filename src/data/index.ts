/**
 * Punto único para leer los datos. Valida todo al construir la página:
 * si hay un error, el build se detiene con un mensaje que dice qué corregir.
 */
import { z } from 'zod';
import {
  barberoSchema,
  negocioSchema,
  productoSchema,
  servicioSchema,
  type Barbero,
  type Negocio,
  type Producto,
  type Servicio,
} from './schema';
import { negocio as negocioDatos } from './negocio';
import { barberos as barberosDatos } from './barberos';
import { servicios as serviciosDatos } from './servicios';
import { productos as productosDatos } from './productos';

export interface Catalogo {
  negocio: Negocio;
  barberos: Barbero[];
  servicios: Servicio[];
  productos: Producto[];
}

export class ErrorDeDatos extends Error {
  override name = 'ErrorDeDatos';
}

function validar<T extends z.ZodType>(schema: T, datos: unknown, archivo: string): z.output<T> {
  const resultado = schema.safeParse(datos);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  • ${i.path.join(' → ') || '(todo el archivo)'}: ${i.message}`)
      .join('\n');
    throw new ErrorDeDatos(`Hay un error en src/data/${archivo}:\n${detalle}`);
  }
  return resultado.data;
}

function idsUnicos(lista: { id: string }[], archivo: string): void {
  const vistos = new Set<string>();
  for (const { id } of lista) {
    if (vistos.has(id))
      throw new ErrorDeDatos(`En src/data/${archivo} el id "${id}" está repetido.`);
    vistos.add(id);
  }
}

export function cargarCatalogo(datos: {
  negocio: unknown;
  barberos: unknown;
  servicios: unknown;
  productos: unknown;
}): Catalogo {
  const negocio = validar(negocioSchema, datos.negocio, 'negocio.ts');
  const barberos = validar(
    z.array(barberoSchema).min(1, 'Debe haber al menos un barbero'),
    datos.barberos,
    'barberos.ts',
  );
  const servicios = validar(
    z.array(servicioSchema).min(1, 'Debe haber al menos un servicio'),
    datos.servicios,
    'servicios.ts',
  );
  const productos = validar(z.array(productoSchema), datos.productos, 'productos.ts');

  idsUnicos(barberos, 'barberos.ts');
  idsUnicos(servicios, 'servicios.ts');
  idsUnicos(productos, 'productos.ts');

  const idsServicios = new Set(servicios.map((s) => s.id));
  for (const b of barberos) {
    for (const s of b.servicios ?? []) {
      if (!idsServicios.has(s)) {
        throw new ErrorDeDatos(
          `En src/data/barberos.ts, ${b.apodo} tiene el servicio "${s}", que no existe en servicios.ts.`,
        );
      }
    }
  }

  return { negocio, barberos, servicios, productos };
}

export const catalogo: Catalogo = cargarCatalogo({
  negocio: negocioDatos,
  barberos: barberosDatos,
  servicios: serviciosDatos,
  productos: productosDatos,
});

/** Servicios que hace un barbero, en el orden de servicios.ts. */
export function serviciosDe(barbero: Barbero, servicios: Servicio[]): Servicio[] {
  if (!barbero.servicios) return servicios;
  const propios = new Set(barbero.servicios);
  return servicios.filter((s) => propios.has(s.id));
}
