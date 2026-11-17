import { m } from 'motion/react';
import type { Paso } from './estado';

const PASOS = ['Barbero', 'Servicio', 'Día y hora', 'Tus datos', 'WhatsApp'] as const;

export function Progreso({ paso }: { paso: Paso }) {
  return (
    <ol className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="Pasos de la reserva">
      {PASOS.map((nombre, i) => (
        <li
          key={nombre}
          className="flex flex-col gap-1.5"
          aria-current={i === paso ? 'step' : undefined}
        >
          <span className="bg-borde relative h-1 overflow-hidden rounded-full">
            <m.span
              className="bg-laton absolute inset-0 origin-left rounded-full"
              initial={false}
              animate={{ scaleX: i <= paso ? 1 : 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </span>
          <span
            className={`text-[11px] font-semibold transition-colors sm:text-xs ${i === paso ? 'text-texto' : 'text-gris'}`}
          >
            {nombre}
          </span>
        </li>
      ))}
    </ol>
  );
}
