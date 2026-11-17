import { expect, test, type Locator, type Page } from '@playwright/test';
import { catalogo } from '../../src/data';
import { simularSupabase } from './supabase-falso';

const { productos } = catalogo;
import { abrir } from './utiles';

/** Todos los elementos están dentro del ancho de la pantalla (nada cortado a la derecha ni a la izquierda). */
async function dentroDePantalla(page: Page, elementos: Locator) {
  const ancho = page.viewportSize()!.width;
  for (const caja of await elementos.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { izq: r.left, der: r.right, texto: (el.textContent ?? '').trim().slice(0, 30) };
    }),
  )) {
    expect(caja.izq, `"${caja.texto}" se sale por la izquierda`).toBeGreaterThanOrEqual(0);
    expect(caja.der, `"${caja.texto}" se sale por la derecha`).toBeLessThanOrEqual(ancho);
  }
}

// Ninguna página debe ser más ancha que la pantalla del celular (eso hace que se vea alejada).
for (const ruta of ['/', '/reservar?barbero=apu', '/tienda']) {
  test(`sin desborde horizontal en ${ruta}`, async ({ page }) => {
    await abrir(page, ruta);
    if (ruta.includes('reservar')) {
      await page.getByRole('button', { name: /^Corte \+ barba Corte/ }).click();
    }
    const ancho = await page.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      pantalla: window.innerWidth,
    }));
    expect(ancho.documento).toBeLessThanOrEqual(ancho.pantalla);
  });
}

// El celular angosto más común (360 px): aquí es donde las cosas se cortaban.
test.describe('celular angosto (360 px)', () => {
  test.use({ viewport: { width: 360, height: 760 } });

  test('el nombre de la barbería entra en una sola línea', async ({ page }) => {
    await abrir(page, '/');
    const logo = page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Maick Barber King' });
    const caja = await logo.boundingBox();
    expect(caja!.height).toBeLessThan(32);
  });

  test('la portada entra completa y el botón fijo no la tapa', async ({ page }) => {
    await abrir(page, '/');
    const nota = page.locator('[data-portada]').getByText('Pagas en la barbería');
    await expect(nota).toBeInViewport({ ratio: 1 });
    await expect(page.locator('[data-barra-reservar]')).not.toBeInViewport();
    // Al bajar, el botón fijo aparece.
    await page.mouse.wheel(0, 1200);
    await expect(page.locator('[data-barra-reservar]')).toBeInViewport();
  });

  test('la galería no corta fotos', async ({ page }) => {
    await abrir(page, '/');
    await dentroDePantalla(
      page,
      page.getByRole('region', { name: 'Cortes de la casa' }).getByRole('listitem'),
    );
  });

  test('todos los días para reservar se ven completos', async ({ page }) => {
    await simularSupabase(page);
    await abrir(page, '/reservar?barbero=apu');
    await page.getByRole('button', { name: /^Corte \+ barba Corte/ }).click();
    await dentroDePantalla(page, page.getByRole('group', { name: 'Día' }).getByRole('button'));
  });

  test('"Agotado" no tapa la categoría del producto', async ({ page }) => {
    const agotadoEnDatos = productos.find((p) => p.disponible === false);
    test.skip(!agotadoEnDatos, 'Ahora no hay productos agotados en src/data/productos.ts');
    await abrir(page, '/tienda');
    const tarjeta = page.getByRole('listitem').filter({ hasText: agotadoEnDatos!.nombre });
    const categoria = await tarjeta
      .getByText(agotadoEnDatos!.categoria, { exact: true })
      .boundingBox();
    const agotado = await tarjeta.getByText('Agotado', { exact: true }).boundingBox();
    const seCruzan =
      categoria!.x < agotado!.x + agotado!.width &&
      agotado!.x < categoria!.x + categoria!.width &&
      categoria!.y < agotado!.y + agotado!.height &&
      agotado!.y < categoria!.y + categoria!.height;
    expect(seCruzan).toBe(false);
  });
});
