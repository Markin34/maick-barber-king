/**
 * Reglas que deben cumplir los datos de la barbería.
 * Si algo no cumple, la página no se construye y el error dice qué archivo y qué campo corregir.
 */
import { z } from 'zod';
import { aMinutos } from '../lib/tiempo';

const hora = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    'Usa el formato HH:MM de 24 horas, por ejemplo "09:30" o "18:00"',
  );

const id = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Solo minúsculas, números y guiones, por ejemplo "corte-barba"',
  );

const whatsapp = z
  .string()
  .regex(
    /^\+591[67]\d{7}$/,
    'Celular boliviano con código de país, sin espacios: "+591" y 8 dígitos que empiezan con 6 o 7',
  );

const precio = z.number().int('El precio va en bolivianos enteros, sin centavos').positive();

export const horarioDiaSchema = z
  .object({
    abre: hora,
    cierra: hora,
    descanso: z.object({ desde: hora, hasta: hora }).optional(),
  })
  .superRefine((h, ctx) => {
    if (aMinutos(h.abre) >= aMinutos(h.cierra)) {
      ctx.addIssue({
        code: 'custom',
        path: ['cierra'],
        message: `La hora de cierre (${h.cierra}) debe ser después de la apertura (${h.abre})`,
      });
    }
    if (h.descanso) {
      const desde = aMinutos(h.descanso.desde);
      const hasta = aMinutos(h.descanso.hasta);
      if (desde >= hasta) {
        ctx.addIssue({
          code: 'custom',
          path: ['descanso'],
          message: 'El descanso debe terminar después de empezar',
        });
      }
      if (desde < aMinutos(h.abre) || hasta > aMinutos(h.cierra)) {
        ctx.addIssue({
          code: 'custom',
          path: ['descanso'],
          message: 'El descanso debe estar dentro del horario de atención',
        });
      }
    }
  });

export { DIAS, NOMBRE_DIA, type Dia } from './dias';

/** `null` significa cerrado ese día. */
const diaHorario = horarioDiaSchema.nullable();
export const horarioSemanalSchema = z.object({
  lunes: diaHorario,
  martes: diaHorario,
  miercoles: diaHorario,
  jueves: diaHorario,
  viernes: diaHorario,
  sabado: diaHorario,
  domingo: diaHorario,
});

export const negocioSchema = z.object({
  nombre: z.string().min(2),
  eslogan: z.string().min(2),
  descripcion: z.string().min(10),
  /** WhatsApp que recibe los pedidos de la tienda. */
  whatsapp,
  direccion: z.string().min(5),
  ciudad: z.string().min(2),
  mapsUrl: z.url('Pega el link completo de Google Maps'),
  instagram: z.url().optional(),
  tiktok: z.url().optional(),
  zonaHoraria: z.string().default('America/La_Paz'),
  horario: horarioSemanalSchema,
  /** Cada cuántos minutos se ofrece una hora: 15, 20, 30 o 60. */
  intervaloMin: z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
  /** Hasta cuántos días adelante se puede reservar. */
  diasAnticipacion: z.number().int().min(1).max(60),
  /**
   * La última reserva del día es esta cantidad de minutos antes del cierre.
   * Ej.: cierra 20:30 y 30 → la última hora para reservar es 20:00 (dure lo que dure el servicio).
   */
  ultimaReservaAntesDelCierre: z.number().int().min(0).max(240).default(0),
  /** Minutos mínimos entre "ahora" y la hora reservada. */
  minutosMinimos: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  formaDePago: z.string().min(3),
  /** Fotos (rutas dentro de src/assets). */
  fotos: z
    .object({
      portada: z.string().optional(),
      local: z.string().optional(),
      galeria: z.array(z.object({ ruta: z.string(), texto: z.string().min(3) })).default([]),
    })
    .prefault({}),
});

export const servicioSchema = z.object({
  id,
  nombre: z.string().min(2),
  descripcion: z.string().min(3),
  precio,
  duracionMin: z
    .number()
    .int()
    .min(5)
    .max(300)
    .refine((n) => n % 5 === 0, 'La duración debe ser múltiplo de 5 minutos'),
});

export const barberoSchema = z.object({
  id,
  nombre: z.string().min(2),
  /** Cómo lo conocen los clientes, por ejemplo "Micki". */
  apodo: z.string().min(1),
  especialidad: z.string().min(3),
  whatsapp,
  /** Ruta dentro de src/assets, por ejemplo "barberos/micki.jpg". Opcional. */
  foto: z.string().optional(),
  /** Foto de un trabajo suyo para el fondo de su tarjeta. Opcional. */
  trabajo: z.string().optional(),
  /** Solo los días que cambian respecto al horario de la barbería. `null` = no trabaja ese día. */
  horario: horarioSemanalSchema.partial().optional(),
  /** ids de los servicios que hace. Si no se pone, hace todos. */
  servicios: z.array(id).optional(),
});

export const productoSchema = z.object({
  id,
  nombre: z.string().min(2),
  descripcion: z.string().min(3),
  categoria: z.string().min(2),
  /** Opcional: sin precio, la tienda muestra "Precio a consultar". */
  precio: precio.optional(),
  /** Ruta dentro de src/assets, por ejemplo "productos/cera.jpg". Opcional. */
  imagen: z.string().optional(),
  disponible: z.boolean().default(true),
});

export type HorarioDia = z.output<typeof horarioDiaSchema>;
export type Negocio = z.output<typeof negocioSchema>;
export type Servicio = z.output<typeof servicioSchema>;
export type Barbero = z.output<typeof barberoSchema>;
export type Producto = z.output<typeof productoSchema>;

export type NegocioEntrada = z.input<typeof negocioSchema>;
export type ServicioEntrada = z.input<typeof servicioSchema>;
export type BarberoEntrada = z.input<typeof barberoSchema>;
export type ProductoEntrada = z.input<typeof productoSchema>;
