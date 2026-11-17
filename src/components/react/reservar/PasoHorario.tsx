import { AnimatePresence, m } from 'motion/react';
import type { Hora } from '../../../lib/horarios';
import { fechaCorta, fechaLarga, hora12 } from '../../../lib/formato';
import { TOQUE, aparecer, cascada } from '../comun/animaciones';
import type { CargaOcupados } from './hooks';

interface Props {
  apodo: string;
  hoy: string;
  dias: string[];
  fechaActiva?: string;
  horas: Hora[];
  horaElegida?: string;
  carga: CargaOcupados;
  enLinea: boolean;
  aviso?: string;
  diasAnticipacion: number;
  onFecha: (fecha: string) => void;
  onHora: (hora: string) => void;
  onContinuar: () => void;
  onReintentar: () => void;
  onRespaldo: () => void;
}

/** Agrupa las horas en Mañana (antes de 12), Tarde (12 a 18) y Noche (desde 18). */
function porTramo(horas: Hora[]): [string, Hora[]][] {
  const tramos: [string, Hora[]][] = [
    ['Mañana', []],
    ['Tarde', []],
    ['Noche', []],
  ];
  for (const h of horas) {
    const i = h.hora < '12:00' ? 0 : h.hora < '18:00' ? 1 : 2;
    tramos[i]![1].push(h);
  }
  return tramos.filter(([, lista]) => lista.length > 0);
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <p className="text-gris text-sm" role="status">
        Revisando horarios disponibles…
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="bg-panel-2 h-11 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function PasoHorario(p: Props) {
  const esperando = p.enLinea && p.carga.estado !== 'listo';

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence>
        {p.aviso && (
          <m.p
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border-rojo/30 bg-rojo/5 text-rojo rounded-xl border p-4 text-sm"
          >
            {p.aviso}
          </m.p>
        )}
      </AnimatePresence>

      {esperando && p.carga.estado === 'error' ? (
        <div className="tarjeta flex flex-col gap-4 p-5" role="alert">
          <p>No pudimos revisar qué horas están ocupadas.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-principal" onClick={p.onReintentar}>
              Reintentar
            </button>
            <button type="button" className="btn-secundario" onClick={p.onRespaldo}>
              Reservar solo por WhatsApp
            </button>
          </div>
        </div>
      ) : esperando ? (
        <Esqueleto />
      ) : p.dias.length === 0 ? (
        <p className="tarjeta text-gris p-5">
          {p.apodo} no tiene horas libres en los próximos {p.diasAnticipacion} días. Prueba con otro
          barbero.
        </p>
      ) : (
        <>
          {/* min-w-0: sin esto el fieldset se estira al ancho de todos los días y la página se aleja en celular. */}
          <fieldset className="min-w-0">
            <legend className="text-gris mb-3 text-sm font-semibold">Día</legend>
            {/* Cuadrícula en vez de tira deslizable: todos los días se ven, ninguno queda cortado. */}
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
              {p.dias.map((d) => {
                const c = fechaCorta(d);
                const activo = d === p.fechaActiva;
                return (
                  <m.button
                    key={d}
                    type="button"
                    onClick={() => p.onFecha(d)}
                    aria-pressed={activo}
                    aria-label={fechaLarga(d)}
                    whileTap={TOQUE}
                    className={`relative flex min-w-0 flex-col items-center rounded-xl border py-2.5 transition-colors ${activo ? 'border-laton' : 'border-borde hover:border-gris'}`}
                  >
                    {activo && (
                      <m.span
                        layoutId="dia-activo"
                        className="bg-laton/15 absolute inset-0 rounded-xl"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-gris relative text-xs">
                      {d === p.hoy ? 'Hoy' : c.dia}
                    </span>
                    <span className="relative text-lg font-bold">{c.numero}</span>
                    <span className="text-gris relative text-[11px]">{c.mes}</span>
                  </m.button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="text-gris mb-3 text-sm font-semibold">
              Hora · {p.fechaActiva && fechaLarga(p.fechaActiva)}
            </legend>
            <m.div
              key={p.fechaActiva}
              className="flex flex-col gap-4"
              variants={cascada(0.01)}
              initial="oculto"
              animate="visible"
            >
              {porTramo(p.horas).map(([tramo, horas]) => (
                <div key={tramo} className="flex flex-col gap-2">
                  <p className="text-gris text-xs font-semibold tracking-wide uppercase">{tramo}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {horas.map(({ hora, libre }) => {
                      const elegida = hora === p.horaElegida;
                      return (
                        <m.button
                          key={hora}
                          variants={aparecer}
                          type="button"
                          onClick={() => p.onHora(hora)}
                          disabled={!libre}
                          aria-pressed={elegida}
                          aria-label={libre ? hora12(hora) : `${hora12(hora)}, ocupada`}
                          whileTap={libre ? TOQUE : undefined}
                          className={`min-h-11 rounded-xl border text-sm font-semibold tabular-nums transition-colors ${
                            !libre
                              ? 'border-borde text-gris/60 cursor-not-allowed border-dashed line-through'
                              : elegida
                                ? 'border-laton bg-laton text-fondo'
                                : 'border-borde bg-panel hover:border-gris'
                          }`}
                        >
                          {hora12(hora)}
                        </m.button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </m.div>
            <p className="text-gris mt-3 text-xs">
              {p.enLinea
                ? 'Las horas tachadas ya están reservadas.'
                : 'Tu barbero confirma la hora por WhatsApp.'}
            </p>
          </fieldset>

          <m.button
            type="button"
            whileTap={p.horaElegida ? TOQUE : undefined}
            className="btn-principal w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:self-end"
            disabled={!p.horaElegida}
            onClick={p.onContinuar}
          >
            {p.horaElegida ? 'Continuar' : 'Elige una hora'}
          </m.button>
        </>
      )}
    </div>
  );
}
