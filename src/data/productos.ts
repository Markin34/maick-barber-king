import type { ProductoEntrada } from './schema';

// Productos que vende la barbería. Sin `precio` aparecen como "Precio a consultar":
// cuando tengas el precio, agrégalo (por ejemplo precio: 35).
// Para agregar foto: guárdala en src/assets/fotos/productos/ y escribe su ruta en `imagen`,
// por ejemplo imagen: 'fotos/productos/minoxidil.jpg'.
// Si un producto se acaba, pon `disponible: false` y aparece como "Agotado".
export const productos = [
  {
    id: 'minoxidil',
    nombre: 'Minoxidil Kirkland 5%',
    descripcion: 'Para estimular el crecimiento de la barba y el cabello. Frasco de 60 ml.',
    categoria: 'Barba',
    imagen: 'fotos/productos/minoxidil-kirkland.jpg',
  },
  {
    id: 'cera-telarana-bandido',
    nombre: 'Cera telaraña Bandido',
    descripcion: 'Bandido Fiber Wax, efecto telaraña. Fijación firme, 150 ml.',
    categoria: 'Ceras',
    imagen: 'fotos/productos/bandido-spider.jpg',
  },
  {
    id: 'cera-telarana-inmortal',
    nombre: 'Cera telaraña Immortal',
    descripcion:
      'Immortal "Show Must Go On" con keratina vegetal. Brillo medio, fijación flexible.',
    categoria: 'Ceras',
    imagen: 'fotos/productos/immortal-spider.png',
  },
  {
    id: 'cera-telarana-dorsh',
    nombre: 'Cera telaraña Dorsh D7',
    descripcion: 'Dorsh D7 Spider Wax. Textura fibrosa, brillo medio, 150 ml.',
    categoria: 'Ceras',
    imagen: 'fotos/productos/dorsh-d7-spider.png',
  },
  {
    id: 'polvo-big-barber',
    nombre: 'Polvo texturizador Big Barber',
    descripcion: 'Big Barber Pro. Volumen y textura con efecto seco, 15 g.',
    categoria: 'Cabello',
    imagen: 'fotos/productos/big-barber-pro.jpg',
  },
  {
    id: 'cera-telarana-franzy',
    nombre: 'Cera telaraña Franzy',
    descripcion: 'Cera tipo telaraña: fija y deja el cabello con textura.',
    categoria: 'Ceras',
    imagen: 'fotos/productos/cera-franzy.jpg',
  },
  {
    id: 'crema-peinar',
    nombre: 'Crema de peinar',
    descripcion: 'Para peinar y controlar el cabello todo el día.',
    categoria: 'Cabello',
    imagen: 'fotos/productos/crema-peinar-revive.jpg',
  },
  {
    id: 'cera-premium-nea',
    nombre: 'Cera premium NEA',
    descripcion: 'Cera de gama premium para peinar.',
    categoria: 'Ceras',
    imagen: 'fotos/productos/cera-premium-nba.jpg',
  },
  {
    id: 'cera-fijadora-bandido',
    nombre: 'Cera fijadora Bandido',
    descripcion: 'Bandido Aqua Wax 8: fijación extrema con brillo, a base de agua.',
    categoria: 'Ceras',
    imagen: 'fotos/productos/bandido-aqua-wax-8.jpg',
  },
] satisfies ProductoEntrada[];
