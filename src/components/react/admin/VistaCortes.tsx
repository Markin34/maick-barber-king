/**
 * Cortes: el dueño anota a mano los cortes hechos en el local (clientes sin reserva).
 * Cada corte se suma al barbero que lo hizo, junto con las citas de la página que asistieron.
 */
import { AnimatePresence, m } from 'motion/react';
import { useId, useMemo, useState, type ComponentProps } from 'react';
import { cortesPorBarbero, ordenarCitas } from '../../../lib/admin';
import { fechaLarga, formatoBs, hora12 } from '../../../lib/formato';
import { aHora, ahoraEn } from '../../../lib/tiempo';
import { TOQUE, aparecer, cascada } from '../comun/animaciones';
import { usePanel } from './contexto';

const CAMPO =
  'bg-panel border-borde focus:border-laton min-h-12 rounded-xl border px-3 text-base outline-none';

/** Hora actual redondeada hacia abajo a 5 minutos, "HH:MM". */
const horaActual = (zona: string) => aHora(Math.floor(ahoraEn(zona).minutos / 5) * 5);

export function VistaCortes() {
  const { zona, barberos, servicios, datos, avisar, apodoDe, precioDe } = usePanel();
  const hoy = ahoraEn(zona).fecha;
  const ids = { cliente: useId(), fecha: useId(), hora: useId() };

  const [barbero, setBarbero] = useState(barberos.length === 1 ? barberos[0]!.id : '');
  const [servicio, setServicio] = useState('');
  const [cliente, setCliente] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState(() => horaActual(zona));
  const [guardando, setGuardando] = useState(false);
  const [porQuitar, setPorQuitar] = useState<string>();

  const disponibles = useMemo(() => {
    const propios = barberos.find((b) => b.id === barbero)?.servicios;
    return propios ? servicios.filter((s) => propios.includes(s.nombre)) : servicios;
  }, [barberos, servicios, barbero]);
  const elegido = disponibles.find((s) => s.nombre === servicio);

  const totales = useMemo(
    () => cortesPorBarbero(datos.citas, fecha, barberos, precioDe),
    [datos.citas, fecha, barberos, precioDe],
  );
  const totalDia = totales.reduce((s, t) => s + t.ingresos, 0);
  const manuales = useMemo(
    () =>
      ordenarCitas(
        datos.citas.filter(
          (c) => c.fecha === fecha && c.origen === 'manual' && c.estado !== 'cancelada',
        ),
      ).reverse(),
    [datos.citas, fecha],
  );

  const guardar: ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    if (!barbero) return avisar('Elige el barbero que hizo el corte.');
    if (!elegido) return avisar('Elige el servicio.');
    setGuardando(true);
    try {
      await datos.registrarCorte({
        barbero,
        servicio: elegido.nombre,
        duracionMin: elegido.duracionMin,
        fecha,
        hora,
        cliente,
      });
      avisar(`✂️ ${elegido.nombre} sumado a ${apodoDe(barbero)}`);
      setServicio('');
      setCliente('');
      if (fecha === hoy) setHora(horaActual(zona));
    } catch (err) {
      avisar((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-3xl">Registrar corte</h2>
        <p className="text-gris text-sm">
          Para clientes que llegan sin reserva. Se suma al barbero y al resumen.
        </p>
      </div>

      <form onSubmit={guardar} className="tarjeta flex flex-col gap-5 p-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Barbero</legend>
          <div className="flex flex-wrap gap-2">
            {barberos.map((b) => {
              const activo = barbero === b.id;
              return (
                <m.button
                  key={b.id}
                  type="button"
                  whileTap={TOQUE}
                  aria-pressed={activo}
                  onClick={() => {
                    setBarbero(b.id);
                    if (!b.servicios.includes(servicio)) setServicio('');
                  }}
                  className={`relative isolate min-h-12 rounded-full border px-5 text-base font-semibold transition-colors ${activo ? 'border-laton text-fondo' : 'border-borde'}`}
                >
                  {activo && (
                    <m.span
                      layoutId="corte-barbero"
                      className="bg-laton absolute inset-0 -z-10 rounded-full"
                    />
                  )}
                  {b.apodo}
                </m.button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Servicio</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {disponibles.map((s) => {
              const activo = servicio === s.nombre;
              return (
                <m.button
                  key={s.nombre}
                  type="button"
                  whileTap={TOQUE}
                  aria-pressed={activo}
                  onClick={() => setServicio(s.nombre)}
                  className={`flex min-h-16 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors ${activo ? 'border-laton bg-laton/10' : 'border-borde'}`}
                >
                  <span className="text-sm leading-tight font-semibold">{s.nombre}</span>
                  <span className="text-gris text-sm tabular-nums">{formatoBs(s.precio)}</span>
                </m.button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.cliente} className="text-sm font-semibold">
              Cliente <span className="text-gris font-normal">(opcional)</span>
            </label>
            <input
              id={ids.cliente}
              type="text"
              maxLength={60}
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Cliente en local"
              className={CAMPO}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.fecha} className="text-sm font-semibold">
              Día
            </label>
            <input
              id={ids.fecha}
              type="date"
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value || hoy)}
              required
              className={CAMPO}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.hora} className="text-sm font-semibold">
              Hora
            </label>
            <input
              id={ids.hora}
              type="time"
              step={300}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
              className={CAMPO}
            />
          </div>
        </div>

        <m.button
          type="submit"
          whileTap={TOQUE}
          disabled={guardando}
          className="btn-principal disabled:opacity-70"
        >
          {guardando
            ? 'Guardando…'
            : elegido
              ? `Registrar corte · ${formatoBs(elegido.precio)}`
              : 'Registrar corte'}
        </m.button>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold">
            {fecha === hoy ? 'Cortes de hoy' : `Cortes del ${fechaLarga(fecha)}`}
          </h3>
          <span className="text-gris text-sm tabular-nums">Total {formatoBs(totalDia)}</span>
        </div>
        <m.ul
          key={fecha}
          className="grid gap-3 sm:grid-cols-3"
          variants={cascada(0.05)}
          initial="oculto"
          animate="visible"
        >
          {totales.map((t) => (
            <m.li key={t.id} variants={aparecer} className="tarjeta flex flex-col gap-1 p-4">
              <span className="font-semibold">{apodoDe(t.id)}</span>
              <span className="font-display text-3xl tabular-nums">
                {t.cortes} {t.cortes === 1 ? 'corte' : 'cortes'}
              </span>
              <span className="text-gris text-sm tabular-nums">
                {formatoBs(t.ingresos)}
                {t.manuales > 0 && ` · ${t.manuales} en local`}
              </span>
            </m.li>
          ))}
        </m.ul>
        <p className="text-gris text-xs">
          Suma los cortes anotados aquí y las citas de la página marcadas como “Asistió”.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Anotados a mano</h3>
        {manuales.length === 0 ? (
          <p className="text-gris text-sm">Todavía no anotaste cortes este día.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {manuales.map((c) => (
                <m.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  className="border-borde flex items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <span className="min-w-0 text-sm">
                    <b className="tabular-nums">{hora12(c.hora)}</b> · {c.servicio} ·{' '}
                    {formatoBs(precioDe(c.servicio))}
                    <span className="text-gris block text-xs">
                      {apodoDe(c.barbero)} · {c.cliente}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold ${porQuitar === c.id ? 'bg-rojo text-white' : 'text-rojo underline'}`}
                    onBlur={() => setPorQuitar(undefined)}
                    onClick={() => {
                      if (porQuitar !== c.id) return setPorQuitar(c.id);
                      setPorQuitar(undefined);
                      datos
                        .cambiarEstado(c.id, 'cancelada')
                        .then(() => avisar('Corte quitado.'))
                        .catch((err: Error) => avisar(err.message));
                    }}
                  >
                    {porQuitar === c.id ? '¿Quitar? Toca otra vez' : 'Quitar'}
                  </button>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
