import { abrir } from './utiles';
import { expect, test, type Page } from '@playwright/test';
import { barberos } from '../../src/data/barberos';
import { simularSupabase } from './supabase-falso';

const apu = barberos.find((b) => b.id === 'apu')!;

function textoDeWhatsApp(href: string | null): string {
  expect(href).toMatch(/^https:\/\/api\.whatsapp\.com\/send\?phone=591\d{8}&text=/);
  return decodeURIComponent(href!.split('text=')[1] ?? '');
}

/** Elige Apu → Corte + barba → el segundo día → la primera hora libre. */
async function llegarADatos(page: Page) {
  await abrir(page, '/reservar');
  await page.getByRole('button', { name: /Apu/ }).click();
  await page.getByRole('button', { name: /^Corte \+ barba Corte/ }).click();
  await expect(page.getByRole('heading', { name: '¿Qué día y a qué hora?' })).toBeVisible();
  await page.getByRole('group', { name: 'Día' }).getByRole('button').nth(1).click();
  const horas = page.getByRole('group', { name: /^Hora/ });
  // 09:00 está ocupada en el Supabase falso: se ve tachada y no se puede elegir.
  await expect(horas.getByRole('button', { name: '9:00 am, ocupada' })).toBeDisabled();
  await horas.getByRole('button', { disabled: false }).first().click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible();
}

test('un cliente reserva, se guarda en la base de datos y avisa por WhatsApp', async ({ page }) => {
  const supabase = await simularSupabase(page);
  await llegarADatos(page);

  // Sin nombre no guarda nada y explica por qué.
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();
  await expect(page.getByText('Escribe tu nombre para que Apu sepa quién reserva.')).toBeVisible();
  expect(supabase.llamadas.filter((l) => l.funcion === 'crear_reserva')).toHaveLength(0);

  await page.getByLabel('Tu nombre').fill('Carlos Pérez');
  await page.getByLabel(/Nota/).fill('Primera vez');
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();

  await expect(page.getByRole('heading', { name: '¡Reserva confirmada!' })).toBeVisible();
  await expect(page.getByText('ABC123')).toBeVisible();

  const guardada = supabase.llamadas.find((l) => l.funcion === 'crear_reserva')!.cuerpo;
  expect(guardada).toMatchObject({
    p_barbero: 'apu',
    p_servicio: 'Corte + barba',
    p_duracion_min: 45,
    p_cliente: 'Carlos Pérez',
    p_nota: 'Primera vez',
  });
  expect(guardada.p_hora).not.toBe('09:00');

  const aviso = page.getByRole('link', { name: 'Enviar por WhatsApp a Apu' });
  expect(await aviso.getAttribute('href')).toContain(`phone=${apu.whatsapp.replace('+', '')}&`);
  const texto = textoDeWhatsApp(await aviso.getAttribute('href'));
  expect(texto).toContain('Hola Apu, reservé en Maick Barber King:');
  expect(texto).toContain('Corte + barba · Bs 60 · 45 min');
  expect(texto).toContain('🔖 Reserva ABC123');
});

test('si alguien ganó la hora, vuelve a elegir con los horarios actualizados', async ({ page }) => {
  const supabase = await simularSupabase(page, {
    crear: () => ({ status: 400, json: { message: 'HORA_OCUPADA' } }),
  });
  await llegarADatos(page);
  await page.getByLabel('Tu nombre').fill('Carlos');
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();

  await expect(page.getByRole('heading', { name: '¿Qué día y a qué hora?' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(
    'Alguien acaba de reservar esa hora. Elige otra.',
  );
  await expect
    .poll(() => supabase.llamadas.filter((l) => l.funcion === 'horarios_ocupados').length)
    .toBeGreaterThanOrEqual(2);
});

test('si Supabase no responde, se puede reservar solo por WhatsApp', async ({ page }) => {
  await simularSupabase(page, { ocupados: () => 'caida' });
  await abrir(page, '/reservar?barbero=apu');
  await page.getByRole('button', { name: /Corte normal/ }).click();
  await expect(page.getByText('No pudimos revisar qué horas están ocupadas.')).toBeVisible();
  await page.getByRole('button', { name: 'Reservar solo por WhatsApp' }).click();

  await page.getByRole('group', { name: /^Hora/ }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Tu nombre').fill('Ana');
  const enviar = page.getByRole('link', { name: 'Enviar reserva por WhatsApp' });
  expect(textoDeWhatsApp(await enviar.getAttribute('href'))).toContain('¿Me confirmas la hora?');
});

test('cada barbero muestra su propia disponibilidad', async ({ page }) => {
  // Apu tiene todo ocupado; Micki y Víctor están libres.
  await simularSupabase(page, {
    ocupados: (c) =>
      c.p_barbero === 'apu'
        ? {
            json: [
              {
                inicio: `${String(c.p_desde)}T00:00:00-04:00`,
                fin: `${String(c.p_hasta)}T23:59:00-04:00`,
              },
            ],
          }
        : { json: [] },
  });
  await abrir(page, '/reservar');
  await expect(
    page.getByRole('button', { name: /Apu/ }).getByText('Sin horas libres por ahora'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Micki/ }).getByText(/^Próxima hora libre:/),
  ).toBeVisible();

  // Las horas de Micki no salen tachadas por la agenda de Apu.
  await page.getByRole('button', { name: /Micki/ }).click();
  await page.getByRole('button', { name: /Corte normal/ }).click();
  const horas = page.getByRole('group', { name: /^Hora/ });
  await expect(horas.getByRole('button').first()).toBeEnabled();
  await expect(horas.getByRole('button', { name: /ocupada/ })).toHaveCount(0);
});

test('el link "Reservar con…" llega con el barbero ya elegido', async ({ page }) => {
  await abrir(page, '/');
  await page.getByRole('link', { name: 'Reservar con Micki' }).click();
  await expect(page).toHaveURL(/\/reservar\?barbero=micki/);
  await expect(page.getByRole('heading', { name: '¿Qué te hace Micki?' })).toBeVisible();
  // Al llegar así, la página no debe bajar sola: la barra de pasos queda a la vista.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('se puede volver atrás y cambiar de barbero', async ({ page }) => {
  await abrir(page, '/reservar?barbero=victor');
  await page.getByRole('button', { name: '← Atrás' }).click();
  await page.getByRole('button', { name: /Micki/ }).click();
  await expect(page.getByRole('heading', { name: '¿Qué te hace Micki?' })).toBeVisible();
});
