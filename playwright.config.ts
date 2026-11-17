import { defineConfig, devices } from '@playwright/test';

const enCI = Boolean(process.env.CI);
// Puerto propio para no chocar con `npm run dev` (4321): las pruebas siempre usan el build final.
const PUERTO = 4329;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: enCI ? 1 : 0,
  reporter: enCI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'celular',
      // En Windows usa el Microsoft Edge instalado para no descargar otro navegador.
      use: { ...devices['Pixel 7'], channel: enCI ? undefined : 'msedge' },
    },
  ],
  webServer: {
    // Build propio con un Supabase falso; las pruebas responden por él (ver tests/e2e/supabase-falso.ts).
    command: `npx astro build && npx astro preview --port ${PUERTO}`,
    env: {
      ASTRO_OUT_DIR: './dist-e2e',
      PUBLIC_SUPABASE_URL: 'https://supabase.test',
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_pruebas',
    },
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
