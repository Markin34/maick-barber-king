import type { NegocioEntrada } from './schema';

// Datos reales de la barbería. ⚠️ Falta: links de Instagram y TikTok (abajo, en "Redes").
export const negocio = {
  nombre: 'Maick Barber King',
  // Frase de la portada, debajo del nombre (también va en el título de la pestaña).
  eslogan: 'Creando tu estilo, resaltando tu imagen',
  descripcion:
    'Barbería en Bolivia. Elige a tu barbero, el servicio y la hora desde el celular, y te confirmamos por WhatsApp.',
  whatsapp: '+59176923276',
  // Dirección y ubicación tal como figuran en la ficha "Barber King Maick" de Google Maps.
  direccion: 'Av. Maximiliano Kolbe y Bolívar',
  ciudad: 'Cochabamba',
  // Link por ID de la ficha (cid): abre "Barber King Maick" con el pin, en la web y en la app.
  // El link por nombre (/maps/place/Nombre/@lat,lng) a veces abría el mapa sin marcar el local.
  mapsUrl: 'https://maps.google.com/?cid=13497774409510950302',
  // Redes: sin link no aparecen en el pie. Ej.: instagram: 'https://www.instagram.com/maickbarberking/',
  zonaHoraria: 'America/La_Paz',
  horario: {
    // 9:00–12:00 y 14:00–20:30, con almuerzo de 12:00 a 14:00.
    lunes: { abre: '09:00', cierra: '20:30', descanso: { desde: '12:00', hasta: '14:00' } },
    martes: { abre: '09:00', cierra: '20:30', descanso: { desde: '12:00', hasta: '14:00' } },
    miercoles: { abre: '09:00', cierra: '20:30', descanso: { desde: '12:00', hasta: '14:00' } },
    jueves: { abre: '09:00', cierra: '20:30', descanso: { desde: '12:00', hasta: '14:00' } },
    viernes: { abre: '09:00', cierra: '20:30', descanso: { desde: '12:00', hasta: '14:00' } },
    sabado: { abre: '09:00', cierra: '20:30', descanso: { desde: '12:00', hasta: '14:00' } },
    domingo: null,
  },
  // Cada cuántos minutos se ofrece una hora. La reserva ocupa lo que dura el servicio.
  intervaloMin: 15,
  // Cierra 20:30 → la última reserva es a las 20:00.
  ultimaReservaAntesDelCierre: 30,
  diasAnticipacion: 14,
  minutosMinimos: 15,
  formaDePago: 'Pagas en la barbería, en efectivo o QR.',
  // Fotos reales de la barbería, salvo "Perfilado de barba" (Unsplash). Ver src/assets/fotos/CREDITOS.md.
  fotos: {
    // Foto del local de fondo en la portada.
    portada: 'fotos/local/portada-barberia.jpg',
    local: 'fotos/local/barberia.jpg',
    galeria: [
      { ruta: 'fotos/cortes/fade-barberia.jpg', texto: 'Corte fade' },
      { ruta: 'fotos/cortes/clasico-barberia.jpg', texto: 'Corte clásico' },
      { ruta: 'fotos/cortes/barba.jpg', texto: 'Perfilado de barba' },
      { ruta: 'fotos/cortes/perfilado-cejas.jpg', texto: 'Perfilado de cejas' },
      { ruta: 'fotos/local/espejos.jpg', texto: 'Nuestro local' },
    ],
  },
} satisfies NegocioEntrada;
