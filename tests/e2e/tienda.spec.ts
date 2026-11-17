import { abrir, esperarIslas } from './utiles';
import { expect, test } from '@playwright/test';
import { negocio } from '../../src/data/negocio';

test('arma un pedido sin precios y lo envía por WhatsApp', async ({ page }) => {
  await abrir(page, '/tienda');
  const minoxidil = page.getByRole('listitem').filter({ hasText: 'Minoxidil' });
  await expect(minoxidil.getByText('Precio a consultar')).toBeVisible();
  await minoxidil.getByRole('button', { name: 'Agregar' }).click();
  await minoxidil.getByRole('button', { name: 'Agregar otro Minoxidil' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Cera telaraña Bandido' })
    .getByRole('button', { name: 'Agregar' })
    .click();

  await expect(page.getByText('3 productos')).toBeVisible();
  await page.getByRole('button', { name: 'Ver pedido' }).click();

  const dialogo = page.getByRole('dialog', { name: 'Tu pedido' });
  await expect(dialogo.getByText('Te confirmamos el precio por WhatsApp.')).toBeVisible();
  await dialogo.getByLabel(/Tu nombre/).fill('Carlos');

  const href = await dialogo
    .getByRole('link', { name: 'Enviar pedido por WhatsApp' })
    .getAttribute('href');
  const texto = decodeURIComponent(href?.split('text=')[1] ?? '');
  expect(href).toContain(`phone=${negocio.whatsapp.replace('+', '')}&`);
  expect(texto).toContain('• 2 × Minoxidil');
  expect(texto).toContain('• 1 × Cera telaraña Bandido');
  expect(texto).toContain('¿Me confirmas el precio y si lo tienen?');
  expect(texto).toContain('A nombre de: Carlos');
});

test('el carrito se mantiene al recargar la página', async ({ page }) => {
  await abrir(page, '/tienda');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Crema de peinar' })
    .getByRole('button', { name: 'Agregar' })
    .click();
  await expect(page.getByText('1 producto', { exact: true })).toBeVisible();
  await page.reload();
  await esperarIslas(page);
  await expect(page.getByText('1 producto', { exact: true })).toBeVisible();
});
