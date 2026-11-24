import type { ServicioEntrada } from './schema';

// Precios reales en bolivianos. Las duraciones son estimadas: ajústalas si hace falta.
// El "nombre" es lo que se guarda en cada reserva y corte; si lo cambias, las citas viejas
// con el nombre anterior ya no encuentran su precio en el panel.
export const servicios = [
  {
    id: 'corte',
    nombre: 'Corte normal',
    descripcion: 'Tijera y máquina, con acabado limpio.',
    precio: 40,
    duracionMin: 30,
  },
  {
    id: 'corte-ceja',
    nombre: 'Corte + ceja',
    descripcion: 'Corte completo y perfilado de cejas.',
    precio: 50,
    duracionMin: 45,
  },
  {
    id: 'corte-barba',
    nombre: 'Corte + barba',
    descripcion: 'Corte completo y arreglo de barba.',
    precio: 60,
    duracionMin: 45,
  },
  {
    id: 'corte-barba-ceja',
    nombre: 'Corte + barba + ceja',
    descripcion: 'El servicio completo: corte, barba y cejas.',
    precio: 70,
    duracionMin: 60,
  },
  {
    id: 'barba',
    nombre: 'Solo barba',
    descripcion: 'Perfilado, rebaje y arreglo de barba.',
    precio: 25,
    duracionMin: 20,
  },
  {
    id: 'cejas',
    nombre: 'Solo cejas',
    descripcion: 'Limpieza y perfilado de cejas.',
    precio: 15,
    duracionMin: 15,
  },
  {
    id: 'navaja',
    nombre: 'Corte desde navaja',
    descripcion: 'Degradado que arranca desde navaja, bien al ras.',
    precio: 45,
    duracionMin: 45,
  },
  {
    id: 'premilitar',
    nombre: 'Corte premilitar',
    descripcion: 'Corte corto y parejo, reglamentario.',
    precio: 30,
    duracionMin: 30,
  },
  {
    id: 'tinte-negro',
    nombre: 'Tinte negro',
    descripcion: 'Aplicación de tinte negro.',
    precio: 40,
    duracionMin: 45,
  },
] satisfies ServicioEntrada[];
