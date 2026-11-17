import { AnimatePresence, m } from 'motion/react';
import { useId, type ComponentProps } from 'react';
import { MENSAJE_ERROR, type CodigoError } from '../../../lib/reservas-api';
import { IconoWhatsApp } from '../comun/Iconos';
import { TOQUE } from '../comun/animaciones';

interface Props {
  resumen: [string, string][];
  apodo: string;
  cliente: string;
  nota: string;
  nombreValido: boolean;
  mostrarErrores: boolean;
  enLinea: boolean;
  enviando: boolean;
  errorEnvio?: CodigoError;
  /** Link de WhatsApp sin guardar en la base (modo respaldo o si falla la conexión). */
  enlaceSinGuardar?: string;
  formaDePago: string;
  onEscribir: (campo: 'cliente' | 'nota', valor: string) => void;
  onConfirmar: () => void;
  onIntentar: () => void;
}

/** Errores en los que conviene ofrecer reservar directo por WhatsApp. */
const CON_RESPALDO: readonly CodigoError[] = ['SIN_CONEXION', 'SIN_CATALOGO', 'DESCONOCIDO'];

const CAMPO =
  'bg-panel border-borde focus:border-laton rounded-xl border px-4 text-base outline-none transition-colors';

export function PasoDatos(p: Props) {
  const idNombre = useId();
  const idError = useId();
  const idNota = useId();
  const errorNombre = p.mostrarErrores && !p.nombreValido;

  const enviar: ComponentProps<'form'>['onSubmit'] = (e) => {
    e.preventDefault();
    if (p.enLinea) {
      p.onConfirmar();
      return;
    }
    p.onIntentar();
    if (p.enlaceSinGuardar) window.open(p.enlaceSinGuardar, '_blank', 'noopener');
  };

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={enviar}>
      <dl className="tarjeta divide-borde divide-y text-sm">
        {p.resumen.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-gris">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <label htmlFor={idNombre} className="text-sm font-semibold">
          Tu nombre
        </label>
        <input
          id={idNombre}
          name="cliente"
          type="text"
          autoComplete="name"
          enterKeyHint="done"
          maxLength={60}
          value={p.cliente}
          onChange={(e) => p.onEscribir('cliente', e.target.value)}
          aria-invalid={errorNombre}
          aria-describedby={errorNombre ? idError : undefined}
          className={`${CAMPO} min-h-12`}
          placeholder="Ej.: Carlos Pérez"
        />
        <AnimatePresence>
          {errorNombre && (
            <m.span
              id={idError}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-rojo text-sm"
            >
              Escribe tu nombre para que {p.apodo} sepa quién reserva.
            </m.span>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={idNota} className="text-sm font-semibold">
          Nota <span className="text-gris font-normal">(opcional)</span>
        </label>
        <textarea
          id={idNota}
          name="nota"
          rows={2}
          maxLength={200}
          value={p.nota}
          onChange={(e) => p.onEscribir('nota', e.target.value)}
          className={`${CAMPO} py-3`}
          placeholder="Ej.: quiero el mismo corte de la otra vez"
        />
      </div>

      {p.errorEnvio && (
        <div
          role="alert"
          className="border-rojo/30 bg-rojo/5 flex flex-col gap-3 rounded-xl border p-4 text-sm"
        >
          <p className="text-rojo">{MENSAJE_ERROR[p.errorEnvio]}</p>
          {CON_RESPALDO.includes(p.errorEnvio) && p.enlaceSinGuardar && (
            <a
              href={p.enlaceSinGuardar}
              target="_blank"
              rel="noopener noreferrer"
              className="text-texto font-semibold underline"
            >
              Reservar directo por WhatsApp
            </a>
          )}
        </div>
      )}

      {p.enLinea ? (
        <m.button
          type="submit"
          whileTap={p.enviando ? undefined : TOQUE}
          className="btn-principal w-full disabled:cursor-wait disabled:opacity-70"
          disabled={p.enviando}
        >
          {p.enviando ? 'Guardando tu reserva…' : 'Confirmar reserva'}
        </m.button>
      ) : (
        <m.a
          href={p.enlaceSinGuardar ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          whileTap={TOQUE}
          className="btn-wa w-full"
          onClick={(e) => {
            if (!p.enlaceSinGuardar) {
              e.preventDefault();
              p.onIntentar();
            }
          }}
        >
          <IconoWhatsApp />
          Enviar reserva por WhatsApp
        </m.a>
      )}
      <p className="text-gris text-center text-xs">{p.formaDePago}</p>
    </form>
  );
}
