/**
 * Proveedor de animaciones para cada isla de React.
 *
 * - LazyMotion + `m`: el código de animación se baja aparte y después de que la isla ya funciona.
 * - reducedMotion="user": si el celular pide "reducir movimiento", las animaciones se apagan solas.
 */
import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

const cargarFunciones = () => import('./funciones-movimiento').then((m) => m.default);

export function Movimiento({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={cargarFunciones} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
