import { m } from 'motion/react';
import { Avatar } from '../comun/Avatar';
import { TOQUE, aparecer, cascada } from '../comun/animaciones';
import type { BarberoVista } from './tipos';

interface Props {
  barberos: BarberoVista[];
  seleccionado?: string;
  /** Texto de disponibilidad por barbero ("Próxima hora libre: hoy 3:15 p. m."). Opcional. */
  disponibilidad?: ReadonlyMap<string, { texto: string; libreHoy: boolean }>;
  onElegir: (barbero: BarberoVista) => void;
}

export function PasoBarbero({ barberos, seleccionado, disponibilidad, onElegir }: Props) {
  return (
    <m.ul
      className="grid gap-3 sm:grid-cols-3"
      variants={cascada(0.06)}
      initial="oculto"
      animate="visible"
    >
      {barberos.map((b) => (
        <m.li key={b.id} variants={aparecer}>
          <m.button
            type="button"
            onClick={() => onElegir(b)}
            aria-pressed={b.id === seleccionado}
            whileTap={TOQUE}
            whileHover={{ y: -2 }}
            className={`tarjeta group hover:border-laton flex w-full overflow-hidden text-left transition-colors sm:flex-col ${b.id === seleccionado ? 'border-laton' : ''}`}
          >
            {(b.trabajoImg ?? b.retratoImg) && (
              <span
                className={`relative hidden w-full overflow-hidden sm:block ${b.trabajoImg ? 'aspect-[4/3]' : 'aspect-square'}`}
              >
                <img
                  src={(b.trabajoImg ?? b.retratoImg)!.src}
                  srcSet={(b.trabajoImg ?? b.retratoImg)!.srcSet}
                  sizes="(min-width: 640px) 33vw, 100vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              </span>
            )}
            <span className="flex items-center gap-4 p-4">
              <Avatar
                nombre={b.nombre}
                fotoUrl={b.fotoUrl}
                tamano={80}
                // En computadora, si la foto grande de arriba ya es su retrato, no lo repite.
                className={!b.trabajoImg && b.retratoImg ? 'sm:hidden' : ''}
              />
              <span className="min-w-0">
                <span className="font-display block text-xl">{b.apodo}</span>
                <span className="text-gris block text-sm">{b.especialidad}</span>
                {disponibilidad?.get(b.id) && (
                  <m.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${disponibilidad.get(b.id)!.libreHoy ? 'text-wa-oscuro' : 'text-gris'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-2 shrink-0 rounded-full ${disponibilidad.get(b.id)!.libreHoy ? 'bg-wa' : 'bg-borde'}`}
                    />
                    {disponibilidad.get(b.id)!.texto}
                  </m.span>
                )}
              </span>
            </span>
          </m.button>
        </m.li>
      ))}
    </m.ul>
  );
}
