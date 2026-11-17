import { m } from 'motion/react';
import { CheckAnimado, IconoWhatsApp } from '../comun/Iconos';
import { TOQUE } from '../comun/animaciones';

interface Props {
  nombre: string;
  apodo: string;
  /** Código de la reserva, para el link de cancelar. */
  codigo: string;
  resumen: [string, string][];
  enlaceWhatsApp: string;
  formaDePago: string;
  onOtra: () => void;
}

export function PasoConfirmado(p: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <CheckAnimado />
        <p>
          Listo{p.nombre ? `, ${p.nombre}` : ''}. Tu hora con {p.apodo} quedó guardada y nadie más
          puede reservarla.
        </p>
      </div>
      <div className="border-wa/40 bg-wa/10 rounded-xl border p-4 text-sm">
        <b className="block">Último paso: envía tu reserva por WhatsApp</b>
        Toca el botón verde de abajo y después «Enviar» en WhatsApp, así {p.apodo} sabe que vas.
      </div>
      <m.dl
        className="tarjeta divide-borde divide-y text-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        {p.resumen.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-gris">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </m.dl>
      <m.a
        href={p.enlaceWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-wa w-full"
        whileTap={TOQUE}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <IconoWhatsApp />
        Enviar por WhatsApp a {p.apodo}
      </m.a>
      <p className="text-gris text-center text-xs">
        {p.formaDePago} ¿No puedes ir?{' '}
        <a
          href={`/cancelar?codigo=${encodeURIComponent(p.codigo)}`}
          className="text-texto font-semibold underline"
        >
          Cancela tu reserva
        </a>{' '}
        para liberar la hora.
      </p>
      <button type="button" className="btn-secundario" onClick={p.onOtra}>
        Hacer otra reserva
      </button>
    </div>
  );
}
