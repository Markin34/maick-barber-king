import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Dirección pública de la página. Se usa para Google y para la vista previa al compartir el link.
 * - Con dominio propio: pon SITIO_URL=https://maickbarberking.com en las variables de Vercel.
 * - Sin dominio: Vercel avisa su dirección (*.vercel.app) y se usa esa sola.
 */
const sitio =
  process.env.SITIO_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:4321');

export default defineConfig({
  site: sitio,
  // Las pruebas en celular construyen en otra carpeta para no pisar el build normal.
  outDir: process.env.ASTRO_OUT_DIR ?? './dist',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
