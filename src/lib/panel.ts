/**
 * Dirección secreta del panel del dueño. No aparece en ninguna página pública ni en el código:
 * sale de la variable PANEL_RUTA (en Vercel: Settings → Environment Variables), sin la barra.
 * /admin no existe a propósito (muestra "página no encontrada").
 *
 * - En tu computadora, sin la variable, el panel queda en /panel-local-pruebas.
 * - En Vercel la variable es obligatoria: si falta, el build se detiene y avisa.
 * - Para cambiarla (por ejemplo, si se filtró): cambia PANEL_RUTA en Vercel y vuelve a publicar.
 */
const POR_DEFECTO = 'panel-local-pruebas';
const PROHIBIDAS = ['admin', 'panel', 'dashboard', 'login'];

function leerRuta(): string {
  const valor = process.env.PANEL_RUTA?.trim().replace(/^\/+/, '');
  if (!valor) {
    if (process.env.VERCEL) {
      throw new Error('Falta la variable PANEL_RUTA en Vercel (la dirección secreta del panel).');
    }
    return POR_DEFECTO;
  }
  if (!/^[a-z0-9-]{12,}$/.test(valor) || PROHIBIDAS.includes(valor)) {
    throw new Error(
      'PANEL_RUTA debe tener al menos 12 caracteres: solo minúsculas, números y guiones.',
    );
  }
  return valor;
}

export const RUTA_PANEL = `/${leerRuta()}`;
