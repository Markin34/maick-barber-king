import { AnimatePresence } from 'motion/react';
import { useMemo } from 'react';
import { citasPorBarbero, type Cita } from '../../../lib/admin';
import { diaDeSemana } from '../../../lib/tiempo';
import { usePanel } from './contexto';
import { TarjetaCita } from './TarjetaCita';

/** Citas de un día, una columna por barbero (una debajo de otra en celular). */
export function ListaDelDia({
  fecha,
  citas,
  barbero,
}: {
  fecha: string;
  citas: Cita[];
  barbero: string | null;
}) {
  const { barberos, datos } = usePanel();
  const visibles = useMemo(
    () => (barbero ? barberos.filter((b) => b.id === barbero) : barberos),
    [barbero, barberos],
  );
  const grupos = useMemo(() => citasPorBarbero(citas, fecha, visibles), [citas, fecha, visibles]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {visibles.map((b) => {
        const lista = grupos.get(b.id) ?? [];
        const activas = lista.filter((c) => c.estado !== 'cancelada').length;
        return (
          <section key={b.id} aria-label={`Citas de ${b.apodo}`} className="flex flex-col gap-3">
            <h3 className="flex items-baseline justify-between">
              <span className="font-display text-xl">{b.apodo}</span>
              <span className="text-gris text-sm">
                {activas} {activas === 1 ? 'cita' : 'citas'}
              </span>
            </h3>
            {lista.length === 0 ? (
              <p className="border-borde text-gris rounded-2xl border border-dashed p-4 text-sm">
                {b.diasLibres?.includes(diaDeSemana(fecha)) ? 'Día libre.' : 'Sin citas.'}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {lista.map((c) => (
                    <TarjetaCita key={c.id} cita={c} nueva={datos.recientes.has(c.id)} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
