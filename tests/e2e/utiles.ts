import type { Page } from '@playwright/test';

/** Espera a que las partes interactivas (islas de Astro) estén listas para recibir clics. */
export async function esperarIslas(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('astro-island')).every(
      (isla) => !isla.hasAttribute('ssr'),
    ),
  );
}

/** Abre una ruta y espera a que la página esté lista para usarse. */
export async function abrir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta);
  await esperarIslas(page);
}
