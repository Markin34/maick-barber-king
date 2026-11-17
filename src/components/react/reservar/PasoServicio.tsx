import { m } from 'motion/react';
import type { Servicio } from '../../../data/schema';
import { duracion, formatoBs } from '../../../lib/formato';
import { TOQUE, aparecer, cascada } from '../comun/animaciones';

interface Props {
  servicios: Servicio[];
  seleccionado?: string;
  onElegir: (id: string) => void;
}

export function PasoServicio({ servicios, seleccionado, onElegir }: Props) {
  return (
    <m.ul
      className="flex flex-col gap-3"
      variants={cascada(0.04)}
      initial="oculto"
      animate="visible"
    >
      {servicios.map((s) => (
        <m.li key={s.id} variants={aparecer}>
          <m.button
            type="button"
            onClick={() => onElegir(s.id)}
            aria-pressed={s.id === seleccionado}
            whileTap={TOQUE}
            className={`tarjeta hover:border-laton flex w-full items-center justify-between gap-4 p-4 text-left transition-colors ${s.id === seleccionado ? 'border-laton' : ''}`}
          >
            <span className="min-w-0">
              <span className="block font-semibold">{s.nombre}</span>
              <span className="text-gris block text-sm">
                {s.descripcion} · {duracion(s.duracionMin)}
              </span>
            </span>
            <span className="font-display text-laton shrink-0 text-xl">{formatoBs(s.precio)}</span>
          </m.button>
        </m.li>
      ))}
    </m.ul>
  );
}
