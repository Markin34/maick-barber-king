import type { SupabaseClient } from '@supabase/supabase-js';
import { AnimatePresence, m } from 'motion/react';
import { useId, useState, type ComponentProps } from 'react';
import { correoDeUsuario } from '../../../lib/usuario';
import { TOQUE } from '../comun/animaciones';
const CAMPO =
  'bg-panel border-borde focus:border-laton min-h-12 rounded-xl border px-4 text-base outline-none transition-colors';

export function Ingreso({ supabase, negocio }: { supabase: SupabaseClient; negocio: string }) {
  const idCorreo = useId();
  const idClave = useId();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string>();

  const entrar: ComponentProps<'form'>['onSubmit'] = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(undefined);
    const { error: fallo } = await supabase.auth.signInWithPassword({
      email: correoDeUsuario(correo),
      password: clave,
    });
    setEnviando(false);
    if (fallo) {
      setError(
        fallo.message.toLowerCase().includes('invalid')
          ? 'Usuario o contraseña incorrectos.'
          : 'No pudimos conectarnos. Revisa tu internet e intenta de nuevo.',
      );
    }
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="tarjeta mx-auto flex w-full max-w-sm flex-col gap-6 p-6"
    >
      <div>
        <p className="eyebrow">Solo para el dueño</p>
        <h1 className="font-display mt-2 text-3xl">Panel de {negocio}</h1>
      </div>      <form className="flex flex-col gap-4" onSubmit={entrar}>
        <div className="flex flex-col gap-2">
          <label htmlFor={idCorreo} className="text-sm font-semibold">
            Usuario
          </label>
          <input
            id={idCorreo}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className={CAMPO}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={idClave} className="text-sm font-semibold">
            Contraseña
          </label>
          <input
            id={idClave}
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className={CAMPO}
          />
        </div>
        <AnimatePresence>
          {error && (
            <m.p
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-rojo text-sm"
            >
              {error}
            </m.p>
          )}
        </AnimatePresence>
        <m.button
          type="submit"
          whileTap={enviando ? undefined : TOQUE}
          disabled={enviando}
          className="btn-principal disabled:cursor-wait disabled:opacity-70"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </m.button>
      </form>
    </m.div>
  );
}
