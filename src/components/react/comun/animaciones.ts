import type { Transition, Variants } from 'motion/react';

/** Curva suave para entradas y salidas. */
export const SUAVE: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

/** Paso que entra desde el lado hacia donde avanza el cliente. `custom` = 1 adelante, -1 atrás. */
export const deslizarPaso: Variants = {
  entra: (direccion: number) => ({ opacity: 0, x: direccion * 28 }),
  quieto: { opacity: 1, x: 0, transition: SUAVE },
  sale: (direccion: number) => ({ opacity: 0, x: direccion * -28, transition: { duration: 0.16 } }),
};

/** Contenedor que hace aparecer a sus hijos en cascada. */
export const cascada = (separacion = 0.035): Variants => ({
  oculto: {},
  visible: { transition: { staggerChildren: separacion } },
});

export const aparecer: Variants = {
  oculto: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: SUAVE },
};

/** Respuesta al tocar un botón o tarjeta. */
export const TOQUE = { scale: 0.97 } as const;
