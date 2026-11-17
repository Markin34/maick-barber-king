import { AnimatePresence, m } from 'motion/react';
import { memo, useState } from 'react';
import { ETIQUETA_ESTADO, nombreClave, type Cita, type EstadoReserva } from '../../../lib/admin';
import { fechaLarga, formatoBs, hora12 } from '../../../lib/formato';
import { linkWhatsApp } from '../../../lib/whatsapp';
import { IconoWhatsApp } from '../comun/Iconos';
import { TOQUE } from '../comun/animaciones';
import { usePanel } from './contexto';

const COLOR_ESTADO: Record<EstadoReserva, string> = {
  confirmada: 'bg-laton/15 text-laton',
  asistio: 'bg-wa/15 text-wa-oscuro',
  no_vino: 'bg-rojo/10 text-rojo',
  cancelada: 'bg-borde text-gris line-through',
};

interface Props {
  cita: Cita;
  mostrarFecha?: boolean;
  nueva?: boolean;
}

export const TarjetaCita = memo(function TarjetaCita({
  cita,
  mostrarFecha = false,
  nueva = false,
}: Props) {
  const { barberos, precioDe, apodoDe, datos, listaNegra, avisar } = usePanel();
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false);
  const barbero = barberos.find((b) => b.id === cita.barbero);
  const inactiva = cita.estado === 'cancelada';
  const vecesEnLista = inactiva ? 0 : (listaNegra.veces.get(nombreClave(cita.cliente)) ?? 0);

  const cambiar = (estado: EstadoReserva) => {
    setConfirmarCancelacion(false);
    datos.cambiarEstado(cita.id, estado).catch((e: Error) => avisar(e.message));
  };

  const aviso =
    barbero?.whatsapp && cita.origen !== 'manual'
      ? linkWhatsApp(
          barbero.whatsapp,
          `Cita ${cita.codigo}: ${cita.cliente}, ${cita.servicio}, ${fechaLarga(cita.fecha)} a las ${hora12(cita.hora)}.`,
        )
      : undefined;

  return (
    <m.li
      layout
      initial={
        nueva ? { opacity: 0, scale: 0.96, backgroundColor: 'rgba(156,106,42,0.18)' } : false
      }
      animate={{ opacity: 1, scale: 1, backgroundColor: 'rgba(250,247,242,1)' }}
      transition={{ duration: 0.6 }}
      className={`border-borde flex flex-col gap-3 rounded-2xl border p-4 ${inactiva ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none tabular-nums">
            {hora12(cita.hora)}
            <span className="text-gris font-sans text-xs font-normal">
              {' '}
              – {hora12(cita.horaFin)}
            </span>
          </p>
          {mostrarFecha && <p className="text-gris mt-1 text-xs">{fechaLarga(cita.fecha)}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${COLOR_ESTADO[cita.estado]}`}
        >
          {nueva && cita.estado === 'confirmada' ? 'Nueva' : ETIQUETA_ESTADO[cita.estado]}
        </span>
      </div>

      <div>
        <p className="font-semibold">{cita.cliente}</p>
        {vecesEnLista > 0 && (
          <p className="bg-rojo/10 text-rojo my-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold">
            🚷 En lista negra
            {vecesEnLista > 1 ? ` (${vecesEnLista} cancelaciones)` : ' (1 cancelación)'}
          </p>
        )}
        <p className="text-gris text-sm">
          {cita.servicio} · {formatoBs(precioDe(cita.servicio))} · {apodoDe(cita.barbero)}
        </p>
        {cita.nota && (
          <p className="bg-panel-2 mt-2 rounded-lg px-3 py-2 text-sm">📝 {cita.nota}</p>
        )}
        <p className="text-gris mt-2 text-xs">
          {cita.origen === 'manual' ? '✂️ Anotado en el local' : `Código ${cita.codigo}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {cita.estado !== 'asistio' && !inactiva && (
          <m.button
            whileTap={TOQUE}
            type="button"
            className="btn min-h-10 bg-wa/10 px-3 text-sm text-wa-oscuro"
            onClick={() => cambiar('asistio')}
          >
            ✅ Asistió
          </m.button>
        )}
        {cita.estado !== 'no_vino' && !inactiva && (
          <m.button
            whileTap={TOQUE}
            type="button"
            className="btn bg-rojo/10 text-rojo min-h-10 px-3 text-sm"
            onClick={() => cambiar('no_vino')}
          >
            ❌ No vino
          </m.button>
        )}
        {cita.estado !== 'confirmada' && (
          <m.button
            whileTap={TOQUE}
            type="button"
            className="btn-secundario min-h-10 px-3 text-sm"
            onClick={() => cambiar('confirmada')}
          >
            ↩ Volver a confirmada
          </m.button>
        )}
        {!inactiva && (
          <m.button
            whileTap={TOQUE}
            type="button"
            className={`btn min-h-10 px-3 text-sm ${confirmarCancelacion ? 'bg-rojo text-white' : 'border-borde border'}`}
            onClick={() =>
              confirmarCancelacion ? cambiar('cancelada') : setConfirmarCancelacion(true)
            }
            onBlur={() => setConfirmarCancelacion(false)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={String(confirmarCancelacion)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                {confirmarCancelacion ? '¿Cancelar? Toca otra vez' : '🚫 Cancelar'}
              </m.span>
            </AnimatePresence>
          </m.button>
        )}
        {aviso && !inactiva && (
          <a
            href={aviso}
            target="_blank"
            rel="noopener noreferrer"
            className="btn border-borde min-h-10 border px-3 text-sm"
            aria-label={`Enviar la cita por WhatsApp a ${barbero?.apodo}`}
          >
            <IconoWhatsApp className="text-wa size-4" />
            Avisar a {barbero?.apodo}
          </a>
        )}
      </div>
    </m.li>
  );
});
