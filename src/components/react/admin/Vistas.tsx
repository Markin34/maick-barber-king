/**
 * Las cuatro secciones del panel: Hoy, Agenda, Bloqueos y Resumen.
 */
import { AnimatePresence, m } from 'motion/react';
import { useDeferredValue, useId, useMemo, useState, type ComponentProps } from 'react';
import { buscarCitas, inicioDeSemana, resumir, type Cita } from '../../../lib/admin';
import { fechaCorta, fechaLarga, formatoBs, hora12 } from '../../../lib/formato';
import { aHora, ahoraEn, sumarDias } from '../../../lib/tiempo';
import { TOQUE, aparecer, cascada } from '../comun/animaciones';
import { usePanel } from './contexto';
import { ListaDelDia } from './ListaDelDia';
import { TarjetaCita } from './TarjetaCita';

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

function Indicador({
  valor,
  etiqueta,
  tono = 'normal',
}: {
  valor: string | number;
  etiqueta: string;
  tono?: 'normal' | 'bien' | 'mal';
}) {
  const color = tono === 'bien' ? 'text-wa-oscuro' : tono === 'mal' ? 'text-rojo' : 'text-texto';
  return (
    <m.div variants={aparecer} className="tarjeta flex flex-col gap-1 p-4">
      <span className={`font-display text-3xl tabular-nums ${color}`}>{valor}</span>
      <span className="text-gris text-xs font-semibold tracking-wide uppercase">{etiqueta}</span>
    </m.div>
  );
}

function FiltroBarbero({
  valor,
  onCambio,
}: {
  valor: string | null;
  onCambio: (v: string | null) => void;
}) {
  const { barberos } = usePanel();
  const opciones = [{ id: null, apodo: 'Todos' }, ...barberos];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por barbero">
      {opciones.map((b) => {
        const activo = valor === b.id;
        return (
          <m.button
            key={b.id ?? 'todos'}
            type="button"
            whileTap={TOQUE}
            aria-pressed={activo}
            onClick={() => onCambio(b.id)}
            className={`relative isolate rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${activo ? 'border-laton text-fondo' : 'border-borde'}`}
          >
            {activo && (
              <m.span
                layoutId="filtro-barbero"
                className="bg-laton absolute inset-0 -z-10 rounded-full"
              />
            )}
            {b.apodo}
          </m.button>
        );
      })}
    </div>
  );
}

const hoyEn = (zona: string) => ahoraEn(zona).fecha;

// ---------------------------------------------------------------------------
// Hoy
// ---------------------------------------------------------------------------

export function VistaHoy() {
  const { zona, datos, precioDe, apodoDe } = usePanel();
  const hoy = hoyEn(zona);
  const r = useMemo(() => resumir(datos.citas, hoy, hoy, precioDe), [datos.citas, hoy, precioDe]);
  const ahoraMin = ahoraEn(zona).minutos;
  const siguiente = datos.citas
    .filter((c) => c.fecha === hoy && c.estado === 'confirmada' && c.minutos >= ahoraMin - 15)
    .sort((a, b) => a.minutos - b.minutos)[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-gris text-sm">{fechaLarga(hoy)}</p>
        <h2 className="font-display text-3xl">Hoy</h2>
      </div>
      <m.div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        variants={cascada(0.06)}
        initial="oculto"
        animate="visible"
      >
        <Indicador valor={r.total - r.canceladas} etiqueta="Citas" />
        <Indicador valor={r.pendientes} etiqueta="Por atender" />
        <Indicador valor={r.atendidas} etiqueta="Atendidas" tono="bien" />
        <Indicador valor={formatoBs(r.ingresos)} etiqueta="Estimado del día" />
      </m.div>
      {siguiente && (
        <p className="bg-laton/10 text-texto rounded-2xl px-4 py-3 text-sm">
          Próxima: <b>{hora12(siguiente.hora)}</b> · {siguiente.cliente} con{' '}
          {apodoDe(siguiente.barbero)}
        </p>
      )}
      <ListaDelDia fecha={hoy} citas={datos.citas} barbero={null} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agenda: día o semana, filtro por barbero y búsqueda
// ---------------------------------------------------------------------------

export function VistaAgenda() {
  const { zona, datos } = usePanel();
  const idBuscar = useId();
  const hoy = hoyEn(zona);
  const [fecha, setFecha] = useState(hoy);
  const [modo, setModo] = useState<'dia' | 'semana'>('dia');
  const [barbero, setBarbero] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const busqueda = useDeferredValue(texto);
  const resultados = useMemo(() => buscarCitas(datos.citas, busqueda), [datos.citas, busqueda]);

  const lunes = inicioDeSemana(fecha);
  const semana = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const filtradas = barbero ? datos.citas.filter((c) => c.barbero === barbero) : datos.citas;
  const mover = (dias: number) => setFecha((f) => sumarDias(f, modo === 'dia' ? dias : dias * 7));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl">Agenda</h2>
        <label htmlFor={idBuscar} className="sr-only">
          Buscar por nombre o código
        </label>
        <input
          id={idBuscar}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar cliente o código…"
          className="bg-panel border-borde focus:border-laton min-h-12 rounded-xl border px-4 text-base outline-none"
        />
      </div>

      {texto.trim().length >= 2 ? (
        <section aria-live="polite" className="flex flex-col gap-3">
          <p className="text-gris text-sm">
            {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'}
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {resultados.slice(0, 40).map((c) => (
              <TarjetaCita key={c.id} cita={c} mostrarFecha />
            ))}
          </ul>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn-secundario min-h-10 px-3"
                onClick={() => mover(-1)}
                aria-label="Anterior"
              >
                ‹
              </button>
              <button
                type="button"
                className="btn-secundario min-h-10 px-3 text-sm"
                onClick={() => setFecha(hoy)}
              >
                Hoy
              </button>
              <button
                type="button"
                className="btn-secundario min-h-10 px-3"
                onClick={() => mover(1)}
                aria-label="Siguiente"
              >
                ›
              </button>
              <span className="ml-2 text-sm font-semibold">
                {modo === 'dia'
                  ? fechaLarga(fecha)
                  : `${fechaCorta(lunes).numero} – ${fechaCorta(semana[6]!).numero} ${fechaCorta(semana[6]!).mes}`}
              </span>
            </div>
            <div className="bg-panel-2 flex rounded-full p-1" role="group" aria-label="Vista">
              {(['dia', 'semana'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={modo === v}
                  onClick={() => setModo(v)}
                  className={`relative isolate rounded-full px-4 py-1.5 text-sm font-semibold ${modo === v ? 'text-fondo' : 'text-gris'}`}
                >
                  {modo === v && (
                    <m.span
                      layoutId="modo-agenda"
                      className="bg-texto absolute inset-0 -z-10 rounded-full"
                    />
                  )}
                  {v === 'dia' ? 'Día' : 'Semana'}
                </button>
              ))}
            </div>
          </div>
          <FiltroBarbero valor={barbero} onCambio={setBarbero} />

          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={`${modo}-${modo === 'dia' ? fecha : lunes}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {modo === 'dia' ? (
                <ListaDelDia fecha={fecha} citas={datos.citas} barbero={barbero} />
              ) : (
                <Semana
                  dias={semana}
                  citas={filtradas}
                  hoy={hoy}
                  onDia={(d) => {
                    setFecha(d);
                    setModo('dia');
                  }}
                />
              )}
            </m.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function Semana({
  dias,
  citas,
  hoy,
  onDia,
}: {
  dias: string[];
  citas: Cita[];
  hoy: string;
  onDia: (d: string) => void;
}) {
  const { apodoDe } = usePanel();
  return (
    <ol className="grid gap-3 md:grid-cols-7">
      {dias.map((d) => {
        const delDia = citas
          .filter((c) => c.fecha === d && c.estado !== 'cancelada')
          .sort((a, b) => a.minutos - b.minutos);
        const c = fechaCorta(d);
        return (
          <li key={d}>
            <button
              type="button"
              onClick={() => onDia(d)}
              className={`tarjeta hover:border-laton flex w-full flex-col gap-2 p-3 text-left transition-colors ${d === hoy ? 'border-laton' : ''}`}
            >
              <span className="flex items-baseline justify-between md:flex-col md:items-start">
                <span className="font-semibold">
                  {c.dia} {c.numero}
                </span>
                <span className="text-gris text-xs">
                  {delDia.length} {delDia.length === 1 ? 'cita' : 'citas'}
                </span>
              </span>
              <span className="flex flex-col gap-1">
                {delDia.slice(0, 6).map((x) => (
                  <span key={x.id} className="bg-panel-2 truncate rounded-md px-2 py-1 text-xs">
                    <b className="tabular-nums">{x.hora}</b> {x.cliente.split(' ')[0]} ·{' '}
                    {apodoDe(x.barbero)}
                  </span>
                ))}
                {delDia.length > 6 && (
                  <span className="text-gris text-xs">+{delDia.length - 6} más</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Bloqueos
// ---------------------------------------------------------------------------

const CAMPO =
  'bg-panel border-borde focus:border-laton min-h-12 rounded-xl border px-3 text-base outline-none';

export function VistaBloqueos() {
  const { zona, barberos, datos, avisar, apodoDe } = usePanel();
  const hoy = hoyEn(zona);
  const ids = {
    barbero: useId(),
    fecha: useId(),
    desde: useId(),
    hasta: useId(),
    motivo: useId(),
    todo: useId(),
  };
  const [barbero, setBarbero] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [desde, setDesde] = useState('13:00');
  const [hasta, setHasta] = useState('14:00');
  const [todoElDia, setTodoElDia] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar: ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    const [d, h] = todoElDia ? ['00:00', '23:59'] : [desde, hasta];
    if (d >= h) {
      avisar('La hora "hasta" debe ser después de "desde".');
      return;
    }
    setGuardando(true);
    try {
      await datos.crearBloqueo({ barbero: barbero || null, fecha, desde: d, hasta: h, motivo });
      setMotivo('');
      avisar('Bloqueo guardado. Esas horas ya no se pueden reservar.');
    } catch (err) {
      avisar((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-3xl">Bloquear horas</h2>
      <form onSubmit={guardar} className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.barbero} className="text-sm font-semibold">
            Barbero
          </label>
          <select
            id={ids.barbero}
            value={barbero}
            onChange={(e) => setBarbero(e.target.value)}
            className={CAMPO}
          >
            <option value="">Todos los barberos</option>
            {barberos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.apodo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.fecha} className="text-sm font-semibold">
            Día
          </label>
          <input
            id={ids.fecha}
            type="date"
            min={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
            className={CAMPO}
          />
        </div>
        <label htmlFor={ids.todo} className="flex items-center gap-3 sm:col-span-2">
          <input
            id={ids.todo}
            type="checkbox"
            checked={todoElDia}
            onChange={(e) => setTodoElDia(e.target.checked)}
            className="accent-laton size-5"
          />
          <span className="text-sm font-semibold">Todo el día</span>
        </label>
        <AnimatePresence initial={false}>
          {!todoElDia && (
            <m.div
              className="grid grid-cols-2 gap-4 sm:col-span-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex flex-col gap-2">
                <label htmlFor={ids.desde} className="text-sm font-semibold">
                  Desde
                </label>
                <input
                  id={ids.desde}
                  type="time"
                  step={900}
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  required
                  className={CAMPO}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor={ids.hasta} className="text-sm font-semibold">
                  Hasta
                </label>
                <input
                  id={ids.hasta}
                  type="time"
                  step={900}
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  required
                  className={CAMPO}
                />
              </div>
            </m.div>
          )}
        </AnimatePresence>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <label htmlFor={ids.motivo} className="text-sm font-semibold">
            Motivo <span className="text-gris font-normal">(opcional, solo lo ves tú)</span>
          </label>
          <input
            id={ids.motivo}
            type="text"
            maxLength={80}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: cita por teléfono, médico, vacaciones"
            className={CAMPO}
          />
        </div>
        <m.button
          type="submit"
          whileTap={TOQUE}
          disabled={guardando}
          className="btn-principal sm:col-span-2 disabled:opacity-70"
        >
          {guardando ? 'Guardando…' : 'Bloquear'}
        </m.button>
      </form>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Próximos bloqueos</h3>
        {datos.bloqueos.length === 0 ? (
          <p className="text-gris text-sm">No hay bloqueos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {datos.bloqueos.map((b) => {
                const ini = ahoraEn(zona, new Date(b.inicio));
                const fin = ahoraEn(zona, new Date(b.fin));
                const dia = ini.minutos === 0 && fin.minutos >= 23 * 60 + 59;
                return (
                  <m.li
                    key={b.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    className="border-borde flex items-center justify-between gap-3 rounded-xl border p-3"
                  >
                    <span className="min-w-0 text-sm">
                      <b>{fechaLarga(ini.fecha)}</b>
                      <span className="text-gris">
                        {' · '}
                        {dia
                          ? 'Todo el día'
                          : `${hora12(aHora(ini.minutos))} – ${hora12(aHora(fin.minutos))}`}
                        {' · '}
                        {apodoDe(b.barbero)}
                      </span>
                      {b.motivo && <span className="text-gris block text-xs">{b.motivo}</span>}
                    </span>
                    <button
                      type="button"
                      className="text-rojo shrink-0 text-sm font-semibold underline"
                      onClick={() =>
                        datos.borrarBloqueo(b.id).catch((err: Error) => avisar(err.message))
                      }
                    >
                      Quitar
                    </button>
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

export function VistaResumen() {
  const { zona, datos, precioDe, apodoDe } = usePanel();
  const hoy = hoyEn(zona);
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const desde = periodo === 'semana' ? inicioDeSemana(hoy) : `${hoy.slice(0, 8)}01`;
  const hasta =
    periodo === 'semana'
      ? sumarDias(desde, 6)
      : sumarDias(`${sumarDias(desde, 32).slice(0, 8)}01`, -1);
  const r = useMemo(
    () => resumir(datos.citas, desde, hasta, precioDe),
    [datos.citas, desde, hasta, precioDe],
  );
  const maxCitas = Math.max(1, ...r.porBarbero.map((b) => b.citas));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Resumen</h2>
          <p className="text-gris text-sm">
            {fechaLarga(desde)} – {fechaLarga(hasta)}
          </p>
        </div>
        <div className="bg-panel-2 flex rounded-full p-1" role="group" aria-label="Periodo">
          {(['semana', 'mes'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={periodo === p}
              onClick={() => setPeriodo(p)}
              className={`relative isolate rounded-full px-4 py-1.5 text-sm font-semibold ${periodo === p ? 'text-fondo' : 'text-gris'}`}
            >
              {periodo === p && (
                <m.span
                  layoutId="periodo"
                  className="bg-texto absolute inset-0 -z-10 rounded-full"
                />
              )}
              {p === 'semana' ? 'Esta semana' : 'Este mes'}
            </button>
          ))}
        </div>
      </div>

      <m.div
        key={periodo}
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
        variants={cascada(0.05)}
        initial="oculto"
        animate="visible"
      >
        <Indicador valor={formatoBs(r.ingresos)} etiqueta="Estimado" />
        <Indicador valor={r.total - r.canceladas} etiqueta="Citas" />
        <Indicador valor={r.atendidas} etiqueta="Asistieron" tono="bien" />
        <Indicador
          valor={r.noVinieron}
          etiqueta="No vinieron"
          tono={r.noVinieron > 0 ? 'mal' : 'normal'}
        />
        <Indicador valor={r.canceladas} etiqueta="Canceladas" />
      </m.div>
      <p className="text-gris -mt-4 text-xs">
        El estimado suma los precios de las citas confirmadas y atendidas. No incluye productos.
      </p>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Por barbero</h3>
        {r.porBarbero.length === 0 ? (
          <p className="text-gris text-sm">Sin citas en este periodo.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {r.porBarbero.map((b) => (
              <li key={b.id} className="flex flex-col gap-1">
                <span className="flex justify-between text-sm">
                  <b>{apodoDe(b.id)}</b>
                  <span className="text-gris tabular-nums">
                    {b.citas} citas · {formatoBs(b.ingresos)}
                  </span>
                </span>
                <span className="bg-panel-2 h-3 overflow-hidden rounded-full">
                  <m.span
                    className="bg-laton block h-full origin-left rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: b.citas / maxCitas }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.porServicio.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-semibold">Servicios más pedidos</h3>
          <ol className="divide-borde tarjeta divide-y">
            {r.porServicio.map((s) => (
              <li key={s.nombre} className="flex justify-between px-4 py-3 text-sm">
                <span>{s.nombre}</span>
                <b className="tabular-nums">{s.citas}</b>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
