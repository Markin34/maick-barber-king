/**
 * Recorrido completo del panel: toca cada botón que no cubren las otras pruebas de admin.spec.ts.
 * Con la variable CAPTURAS=<carpeta> además guarda capturas (se usan para el manual del dueño).
 */
import { expect, test, type Page } from '@playwright/test';
import { simularAdmin } from './supabase-admin-falso';
import { abrir } from './utiles';
import { RUTA_PANEL } from '../../src/lib/panel';

const CARPETA = process.env.CAPTURAS;
let paso = 0;
async function foto(page: Page, nombre: string) {
  if (!CARPETA) return;
  await page.waitForTimeout(500); // que terminen las animaciones
  paso += 1;
  await page.screenshot({
    path: `${CARPETA}/${String(paso).padStart(2, '0')}-${nombre}.png`,
    // Sin el aviso flotante ("Bloqueo guardado…"), que tapa lo de abajo en la captura.
    style: 'p.fixed[role="status"] { display: none !important; }',
  });
}

const seccion = (page: Page, nombre: RegExp) =>
  page.getByRole('navigation', { name: 'Secciones del panel' }).locator('visible=true')
    .getByRole('button', { name: nombre });

test('recorre todos los botones del panel', async ({ page }) => {
  test.setTimeout(60_000);
  const supabase = await simularAdmin(page);
  await abrir(page, RUTA_PANEL);
  await foto(page, 'ingreso');
  await page.getByLabel('Usuario').fill('admin');
  await page.getByLabel('Contraseña').fill('clave-correcta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();
  await foto(page, 'hoy');

  // --- Tarjeta de una cita: No vino → Volver a confirmada. Sin botón de WhatsApp a sí mismo.
  const deApu = page.getByRole('region', { name: 'Citas de Apu' });
  await expect(deApu.getByRole('link', { name: /WhatsApp/ })).toHaveCount(0);
  await deApu.getByRole('button', { name: '❌ No vino' }).click();
  await expect(deApu.getByText('No vino', { exact: true })).toBeVisible();
  await foto(page, 'no-vino');
  await deApu.getByRole('button', { name: '↩ Volver a confirmada' }).click();
  await expect(deApu.getByText('Confirmada', { exact: true })).toBeVisible();
  const patches = supabase.cambios.filter((c) => c.metodo === 'PATCH').map((c) => c.cuerpo);
  expect(patches).toEqual([{ estado: 'no_vino' }, { estado: 'confirmada' }]);
  await deApu.getByRole('button', { name: '🚫 Cancelar' }).click();
  await foto(page, 'cancelar-confirmar');
  await page.getByRole('heading', { name: 'Hoy', exact: true }).click(); // tocar afuera no cancela
  await expect(deApu.getByText('Confirmada', { exact: true })).toBeVisible();

  // --- Cortes: anotar uno y quitarlo.
  await seccion(page, /Cortes/).click();
  await page.getByRole('button', { name: 'Micki', exact: true }).click();
  await page.getByRole('button', { name: /^Corte normal/ }).click();
  await page.getByLabel(/Cliente/).fill('Luis');
  await foto(page, 'cortes');
  await page.getByRole('button', { name: 'Registrar corte · Bs 40' }).click();
  await expect(page.getByText('✂️ Corte normal sumado a Micki')).toBeVisible();
  await expect(page.getByText('Micki · Luis')).toBeVisible();
  await foto(page, 'cortes-anotado');
  await page.getByRole('button', { name: 'Quitar', exact: true }).click();
  await page.getByRole('button', { name: '¿Quitar? Toca otra vez' }).click();
  await expect(page.getByText('Corte quitado.')).toBeVisible();
  await expect(page.getByText('Micki · Luis')).toHaveCount(0);

  // --- Agenda: días, semana, filtro por barbero.
  await seccion(page, /Agenda/).click();
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
  await foto(page, 'agenda');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Anterior' }).click();
  await page.getByRole('button', { name: 'Anterior' }).click();
  // El botón "Hoy" de la agenda (no el del menú): está justo antes de "Siguiente".
  await page.getByRole('button', { name: 'Siguiente' }).locator('xpath=preceding-sibling::button[1]').click();
  await page.getByRole('group', { name: 'Filtrar por barbero' }).getByRole('button', { name: 'Apu' }).click();
  await expect(page.getByRole('region', { name: 'Citas de Apu' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Citas de Micki' })).toHaveCount(0);
  await foto(page, 'agenda-filtro');
  await page.getByRole('group', { name: 'Filtrar por barbero' }).getByRole('button', { name: 'Todos' }).click();
  await page.getByRole('button', { name: 'Semana' }).click();
  await expect(page.getByText(/Carlos · Apu/)).toBeVisible();
  await foto(page, 'agenda-semana');
  await page.getByRole('button', { name: /Carlos · Apu/ }).click(); // tocar un día abre ese día
  await expect(page.getByRole('region', { name: 'Citas de Apu' })).toBeVisible();
  await page.getByPlaceholder('Buscar cliente o código…').fill('BBB222');
  await expect(page.getByText('1 resultado')).toBeVisible();
  await foto(page, 'agenda-buscar');
  await page.getByPlaceholder('Buscar cliente o código…').fill('');

  // --- Bloqueos: todo el día y quitar.
  await seccion(page, /Bloqueos/).click();
  await page.getByLabel('Todo el día').check();
  await page.getByLabel(/Motivo/).fill('Feriado');
  await foto(page, 'bloqueos');
  await page.getByRole('button', { name: 'Bloquear' }).click();
  await expect(page.getByText('Feriado')).toBeVisible();
  await expect(page.getByText(/Todo el día · Todos/)).toBeVisible();
  await foto(page, 'bloqueos-guardado');
  await page.getByRole('button', { name: 'Quitar' }).click();
  await expect(page.getByText('No hay bloqueos.')).toBeVisible();

  // --- Resumen: semana y mes.
  await seccion(page, /Resumen/).click();
  await expect(page.getByRole('heading', { name: 'Por barbero' })).toBeVisible();
  await foto(page, 'resumen');
  await page.getByRole('button', { name: 'Este mes' }).click();
  await expect(page.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Esta semana' }).click();

  // --- Lista negra: agregar, poner penitencia, quitar.
  await seccion(page, /Lista negra/).click();
  await page.getByRole('button', { name: '＋ Agregar a mano' }).click();
  await page.getByLabel('Cliente').fill('Pedro Rojas');
  await page.getByLabel(/Motivo/).fill('No vino dos veces');
  await page.getByRole('button', { name: 'Agregar a la lista negra' }).click();
  await expect(page.getByText('No vino dos veces')).toBeVisible();
  await page.getByLabel('Penitencia', { exact: true }).fill('Paga por adelantado');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Penitencia guardada.')).toBeVisible();
  await foto(page, 'lista-negra');
  await page.getByPlaceholder('Buscar cliente…').fill('pedro');
  await expect(page.getByText('Pedro Rojas', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar de la lista' }).click();
  await page.getByRole('button', { name: '¿Quitar? Toca otra vez' }).click();
  await expect(page.getByText('Pedro Rojas salió de la lista negra.')).toBeVisible();

  // --- Cerrar sesión.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
});
