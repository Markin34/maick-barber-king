import type { BarberoEntrada } from './schema';

// Por ahora todas las reservas llegan al mismo WhatsApp (+591 76923276).
// Cuando cada barbero quiera recibir las suyas, cambia su número aquí.
// Todos trabajan todos los días que abre la barbería; las ausencias las marca el admin (bloqueos).
// Si algún día un barbero tiene día libre fijo: `horario: { lunes: null }`.
// Fotos (opcionales, cuando las tengan): guárdalas en src/assets/barberos/ y agrega a cada barbero
//   foto: 'barberos/micki.jpg'     → retrato (reemplaza las iniciales)
//   trabajo: 'barberos/micki-corte.jpg' → foto de un corte suyo, arriba de su tarjeta
export const barberos = [
  {
    id: 'micki',
    nombre: 'Luis Miguel Guillén',
    apodo: 'Micki',
    foto: 'barberos/micki-retrato.jpg',
    especialidad: 'Barbero profesional',
    whatsapp: '+59176923276',
  },
  {
    id: 'apu',
    nombre: 'Ariel Romero',
    apodo: 'Apu',
    foto: 'barberos/apu-retrato.jpg',
    especialidad: 'Barbero profesional',
    whatsapp: '+59176923276',
  },
  {
    id: 'victor',
    nombre: 'Víctor Pantoja',
    apodo: 'Víctor',
    foto: 'barberos/victor-retrato.jpg',
    especialidad: 'Barbero profesional',
    whatsapp: '+59176923276',
  },
] satisfies BarberoEntrada[];
