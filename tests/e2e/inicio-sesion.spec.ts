import { expect, test } from '@playwright/test';
import { RUTA_PANEL } from '../../src/lib/panel';
import { abrir } from './utiles';

// Los clientes solo reservan: ninguna página pública debe mostrar un acceso al panel
// ni dejar ver su dirección secreta (ni en el HTML ni en los scripts que carga).
for (const ruta of ['/', '/reservar', '/tienda', '/cancelar', '/no-existe']) {
  test(`sin enlace ni pista del panel en ${ruta}`, async ({ page }) => {
    const scripts: string[] = [];
    page.on('response', async (r) => {
      if (r.url().endsWith('.js')) scripts.push(await r.text().catch(() => ''));
    });
    await abrir(page, ruta);
    await expect(page.getByRole('link', { name: /iniciar sesión|mi panel|admin/i })).toHaveCount(0);
    await expect(page.locator(`a[href^="${RUTA_PANEL}"], a[href^="/admin"]`)).toHaveCount(0);
    expect(await page.content()).not.toContain(RUTA_PANEL);
    for (const js of scripts) expect(js).not.toContain(RUTA_PANEL);
  });
}

test('/admin ya no existe: muestra "página no encontrada"', async ({ page }) => {
  const r = await page.goto('/admin');
  expect(r?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toHaveCount(0);
});

test('el panel abre en su dirección secreta', async ({ page }) => {
  await abrir(page, RUTA_PANEL);
  await expect(page.getByLabel('Contraseña')).toBeVisible();
});
