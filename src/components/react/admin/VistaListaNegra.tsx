/**
 * Lista negra: clientes que cancelaron una cita. Entran solos al cancelar una reserva de la página.
 * El barbero decide la penitencia; es solo una anotación, no impide que vuelvan a reservar.
 */
import { AnimatePresence, m } from 'motion/react';
import { useDeferredValue, useEffect, useId, useState, type ComponentProps } from 'react';
import { nombreClave, type FilaListaNegra } from '../../../lib/admin';
import { fechaLarga, hora12 } from '../../../lib/formato';
import { aHora, ahoraEn } from '../../../lib/tiempo';
import { TOQUE } from '../comun/animaciones';
import { usePanel } from './contexto';

const CAMPO =
  'bg-panel border-borde focus:border-laton min-h-12 rounded-xl border px-3 text-base outline-none';

export function VistaListaNegra() {
  const { listaNegra } = usePanel();
  const idBuscar = useId();
  const [texto, setTexto] = useState('');
  const busqueda = nombreClave(useDeferredValue(texto));
  const [agregando, setAgregando] = useState(false);

  // Al abrir la sección se trae la lista al día (pudo cambiar desde otro celular).
  const { recargar } = listaNegra;
  useEffect(recargar, [recargar]);

  const filas = busqueda
    ? listaNegra.filas.filter((f) => nombreClave(f.cliente).includes(busqueda))
    : listaNegra.filas;
  const clientes = listaNegra.veces.size;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Lista negra</h2>
          <p className="text-gris text-sm">
            Los clientes que cancelan una cita entran solos. La penitencia la decide el barbero.
          </p>
        </div>
        <m.button
          type="button"
          whileTap={TOQUE}
          aria-expanded={agregando}
          className="btn-secundario min-h-10 px-4 text-sm"
          onClick={() => setAgregando((a) => !a)}
        >
          {agregando ? 'Cerrar' : '＋ Agregar a mano'}
        </m.button>
      </div>

      <AnimatePresence initial={false}>
        {agregando && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <FormularioAgregar alTerminar={() => setAgregando(false)} />
          </m.div>
        )}
      </AnimatePresence>

      {listaNegra.estado === 'error' ? (
        <div className="tarjeta flex flex-col items-start gap-3 p-5" role="alert">
          <p>No pudimos cargar la lista negra. Revisa tu internet.</p>
          <button type="button" className="btn-principal" onClick={recargar}>
            Reintentar
          </button>
        </div>
      ) : listaNegra.estado === 'cargando' && listaNegra.filas.length === 0 ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="bg-panel-2 h-28 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : listaNegra.filas.length === 0 ? (
        <p className="tarjeta text-gris p-5 text-sm">
          Nadie en la lista negra. Cuando canceles una cita, el cliente aparecerá aquí.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={idBuscar} className="sr-only">
              Buscar cliente en la lista negra
            </label>
            <input
              id={idBuscar}
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar cliente…"
              className={CAMPO}
            />
            <p className="text-gris text-sm">
              {clientes} {clientes === 1 ? 'cliente' : 'clientes'} · {listaNegra.filas.length}{' '}
              {listaNegra.filas.length === 1 ? 'cancelación' : 'cancelaciones'}
            </p>
          </div>
          {filas.length === 0 ? (
            <p className="text-gris text-sm">Nadie con ese nombre en la lista.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              <AnimatePresence initial={false}>
                {filas.map((f) => (
                  <TarjetaListaNegra key={f.id} fila={f} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function FormularioAgregar({ alTerminar }: { alTerminar: () => void }) {
  const { listaNegra, avisar } = usePanel();
  const ids = { cliente: useId(), motivo: useId(), penitencia: useId() };
  const [cliente, setCliente] = useState('');
  const [motivo, setMotivo] = useState('');
  const [penitencia, setPenitencia] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar: ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    if (cliente.trim().length < 2) return avisar('Escribe el nombre del cliente.');
    setGuardando(true);
    try {
      await listaNegra.agregar({ cliente, motivo, penitencia });
      avisar(`${cliente.trim()} agregado a la lista negra.`);
      alTerminar();
    } catch (err) {
      avisar((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={ids.cliente} className="text-sm font-semibold">
          Cliente
        </label>
        <input
          id={ids.cliente}
          type="text"
          minLength={2}
          maxLength={60}
          required
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="Nombre como reserva"
          className={CAMPO}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={ids.motivo} className="text-sm font-semibold">
          Motivo <span className="text-gris font-normal">(opcional)</span>
        </label>
        <input
          id={ids.motivo}
          type="text"
          maxLength={120}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej.: canceló por WhatsApp"
          className={CAMPO}
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label htmlFor={ids.penitencia} className="text-sm font-semibold">
          Penitencia <span className="text-gris font-normal">(opcional)</span>
        </label>
        <input
          id={ids.penitencia}
          type="text"
          maxLength={200}
          value={penitencia}
          onChange={(e) => setPenitencia(e.target.value)}
          placeholder="Ej.: la próxima vez paga por adelantado"
          className={CAMPO}
        />
      </div>
      <m.button
        type="submit"
        whileTap={TOQUE}
        disabled={guardando}
        className="btn-principal disabled:opacity-70 sm:col-span-2"
      >
        {guardando ? 'Guardando…' : 'Agregar a la lista negra'}
      </m.button>
    </form>
  );
}

function TarjetaListaNegra({ fila }: { fila: FilaListaNegra }) {
  const { zona, listaNegra, apodoDe, avisar } = usePanel();
  const idPenitencia = useId();
  const [penitencia, setPenitencia] = useState(fila.penitencia ?? '');
  const [guardando, setGuardando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const veces = listaNegra.veces.get(nombreClave(fila.cliente)) ?? 1;
  const cambio = penitencia.trim() !== (fila.penitencia ?? '');

  const cita = fila.cita_inicio ? ahoraEn(zona, new Date(fila.cita_inicio)) : null;
  const agregado = ahoraEn(zona, new Date(fila.creado_en));

  const guardar = async () => {
    setGuardando(true);
    try {
      await listaNegra.cambiarPenitencia(fila.id, penitencia);
      avisar('Penitencia guardada.');
    } catch (err) {
      avisar((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24 }}
      className="border-borde flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{fila.cliente}</p>
          <p className="text-gris text-sm">
            {fila.reserva_id && fila.servicio
              ? `Canceló: ${fila.servicio}${fila.barbero ? ` con ${apodoDe(fila.barbero)}` : ''}`
              : fila.motivo}
          </p>
          <p className="text-gris text-xs">
            {cita
              ? `Cita del ${fechaLarga(cita.fecha)}, ${hora12(aHora(cita.minutos))}`
              : `Agregado el ${fechaLarga(agregado.fecha)}`}
          </p>
        </div>
        {veces > 1 && (
          <span className="bg-rojo/10 text-rojo shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">
            {veces} veces
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={idPenitencia} className="text-sm font-semibold">
          Penitencia
        </label>
        <div className="flex gap-2">
          <input
            id={idPenitencia}
            type="text"
            maxLength={200}
            value={penitencia}
            onChange={(e) => setPenitencia(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && cambio) void guardar();
            }}
            placeholder="La que diga el barbero"
            className={`${CAMPO} min-w-0 flex-1`}
          />
          <AnimatePresence initial={false}>
            {cambio && (
              <m.button
                type="button"
                whileTap={TOQUE}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                disabled={guardando}
                className="btn-principal min-h-12 shrink-0 px-4 text-sm disabled:opacity-70"
                onClick={() => void guardar()}
              >
                {guardando ? '…' : 'Guardar'}
              </m.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <button
        type="button"
        className={`self-start rounded-lg px-2 py-1 text-sm font-semibold ${confirmarQuitar ? 'bg-rojo text-white' : 'text-gris underline'}`}
        onBlur={() => setConfirmarQuitar(false)}
        onClick={() => {
          if (!confirmarQuitar) return setConfirmarQuitar(true);
          setConfirmarQuitar(false);
          listaNegra
            .quitar(fila.id)
            .then(() => avisar(`${fila.cliente} salió de la lista negra.`))
            .catch((err: Error) => avisar(err.message));
        }}
      >
        {confirmarQuitar ? '¿Quitar? Toca otra vez' : 'Quitar de la lista'}
      </button>
    </m.li>
  );
}
