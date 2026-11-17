/**
 * Escucha errores inesperados de la página y los anota en Supabase (tabla errores_web),
 * para que el dueño se entere si algo le falla a los clientes.
 *
 * - Solo errores de nuestra página: los de extensiones del navegador se ignoran.
 * - Máximo 5 por visita y sin repetir el mismo mensaje.
 */
import type { ConfigSupabase } from './reservas-api';
import { registrarError } from './reservas-api';

const MAXIMO_POR_VISITA = 5;

/** Ruido conocido que no es un error real de la página. */
const IGNORAR = [/ResizeObserver loop/i, /^Script error\.?$/i, /Load failed/i, /Failed to fetch/i];

export function escucharErrores(
  config: ConfigSupabase,
  ventana: Pick<Window, 'addEventListener' | 'location'> = window,
  enviar: typeof registrarError = registrarError,
): void {
  const vistos = new Set<string>();

  const anotar = (mensaje: string, detalle?: string) => {
    if (!mensaje || IGNORAR.some((r) => r.test(mensaje))) return;
    if (vistos.has(mensaje) || vistos.size >= MAXIMO_POR_VISITA) return;
    vistos.add(mensaje);
    void enviar(config, { mensaje, pagina: ventana.location.pathname, detalle });
  };

  ventana.addEventListener('error', (e: Event) => {
    const evento = e as ErrorEvent;
    // Sin archivo o de otro origen (extensiones, scripts ajenos): no es nuestro.
    if (!evento.filename?.startsWith(ventana.location.origin)) return;
    const error = evento.error as Error | undefined;
    anotar(evento.message, error?.stack ?? `${evento.filename}:${evento.lineno}:${evento.colno}`);
  });

  ventana.addEventListener('unhandledrejection', (e: Event) => {
    const razon = (e as PromiseRejectionEvent).reason as unknown;
    if (razon instanceof Error) anotar(razon.message, razon.stack);
    else anotar(String(razon));
  });
}
