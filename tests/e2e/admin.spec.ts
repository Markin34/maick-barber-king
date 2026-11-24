import { expect, test, type Page } from '@playwright/test';
import { simularAdmin } from './supabase-admin-falso';
import { abrir } from './utiles';
import { RUTA_PANEL } from '../../src/lib/panel';

async function entrar(page: Page, clave = 'clave-correcta', usuario = 'admin') {
  await abrir(page, RUTA_PANEL);
  await page.getByLabel('Usuario').fill(usuario);
  await page.getByLabel('Contraseña').fill(clave);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('con la contraseña equivocada no entra y lo dice', async ({ page }) => {
  await simularAdmin(page);
  await entrar(page, 'otra');
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.');
});

test('la sesión no queda guardada: otra pestaña vuelve a pedir contraseña', async ({ page, context }) => {
  await simularAdmin(page);
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();

  // Recargar la misma pestaña mantiene la sesión.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();

  // Otra pestaña (o abrir de nuevo el navegador) pide usuario y contraseña.
  const otra = await context.newPage();
  await simularAdmin(otra);
  await abrir(otra, RUTA_PANEL);
  await expect(otra.getByLabel('Contraseña')).toBeVisible();
  await expect(otra.getByRole('heading', { name: 'Hoy', exact: true })).toHaveCount(0);
});

test('con el panel abierto mucho rato sin usarlo, la sesión sigue', async ({ page }) => {
  await page.clock.install();
  await simularAdmin(page);
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();

  await page.clock.fastForward('03:00:00');
  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toHaveCount(0);
});

test('el dueño ve las citas de hoy y marca una como atendida', async ({ page }) => {
  const supabase = await simularAdmin(page);
  await entrar(page);

  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();
  // Escribiendo solo "admin" se usa el correo interno de la barbería.
  expect(supabase.correos).toEqual(['admin@maickbarberking.com']);
  const deApu = page.getByRole('region', { name: 'Citas de Apu' });
  await expect(deApu.getByText('Carlos Pérez')).toBeVisible();
  await expect(deApu.getByText('📝 Primera vez')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Citas de Micki' }).getByText('José Gómez'),
  ).toBeVisible();

  await deApu.getByRole('button', { name: '✅ Asistió' }).click();
  await expect(deApu.getByText('Asistió', { exact: true })).toBeVisible();
  await expect
    .poll(() => supabase.cambios.find((c) => c.metodo === 'PATCH'))
    .toMatchObject({
      ruta: expect.stringContaining('id=eq.r1'),
      cuerpo: { estado: 'asistio' },
    });
});

test('cancelar pide confirmación con un segundo toque', async ({ page }) => {
  const supabase = await simularAdmin(page);
  await entrar(page);
  const deMicki = page.getByRole('region', { name: 'Citas de Micki' });
  await deMicki.getByRole('button', { name: '🚫 Cancelar' }).click();
  expect(supabase.cambios.filter((c) => c.metodo === 'PATCH')).toHaveLength(0);
  await deMicki.getByRole('button', { name: '¿Cancelar? Toca otra vez' }).click();
  await expect(deMicki.getByText('Cancelada', { exact: true })).toBeVisible();
});

test('eliminar una cita pide escribir ELIMINAR y la borra por completo', async ({ page }) => {
  const supabase = await simularAdmin(page);
  await entrar(page);
  const deMicki = page.getByRole('region', { name: 'Citas de Micki' });
  const eliminarBoton = deMicki.getByRole('button', { name: '🗑 Eliminar' }).first();
  await expect(eliminarBoton).toBeVisible();
  const antes = await deMicki.getByRole('listitem').count();

  await eliminarBoton.click();
  const confirmar = deMicki.getByRole('button', { name: 'Eliminar cita' });
  await expect(confirmar).toBeDisabled();

  // Otra palabra no sirve; "eliminar" en minúsculas sí.
  const campo = deMicki.getByLabel(/Escribe ELIMINAR para confirmar/);
  await campo.fill('borrar');
  await expect(confirmar).toBeDisabled();
  await campo.fill('eliminar');
  await confirmar.click();

  await expect(page.getByText(/eliminada/)).toBeVisible();
  await expect(deMicki.getByRole('listitem')).toHaveCount(antes - 1);
  expect(supabase.cambios.filter((c) => c.metodo === 'DELETE')).toHaveLength(1);
});

test('"No, volver" cierra la confirmación sin borrar nada', async ({ page }) => {
  const supabase = await simularAdmin(page);
  await entrar(page);
  const deMicki = page.getByRole('region', { name: 'Citas de Micki' });
  await deMicki.getByRole('button', { name: '🗑 Eliminar' }).first().click();
  await deMicki.getByRole('button', { name: 'No, volver' }).click();
  await expect(deMicki.getByRole('button', { name: 'Eliminar cita' })).toHaveCount(0);
  expect(supabase.cambios.filter((c) => c.metodo === 'DELETE')).toHaveLength(0);
});

test('busca una cita por nombre sin tildes', async ({ page }) => {
  await simularAdmin(page);
  await entrar(page);
  await page
    .getByRole('button', { name: /Agenda/ })
    .first()
    .click();
  await page.getByPlaceholder('Buscar cliente o código…').fill('jose');
  await expect(page.getByText('1 resultado')).toBeVisible();
  await expect(page.getByText('José Gómez')).toBeVisible();
});

test('bloquea una hora', async ({ page }) => {
  const supabase = await simularAdmin(page);
  await entrar(page);
  await page
    .getByRole('button', { name: /Bloqueos/ })
    .first()
    .click();
  await page.getByLabel('Barbero').selectOption({ label: 'Apu' });
  await page.getByLabel(/Motivo/).fill('Médico');
  await page.getByRole('button', { name: 'Bloquear' }).click();
  await expect(
    page.getByText('Bloqueo guardado. Esas horas ya no se pueden reservar.'),
  ).toBeVisible();
  await expect(page.getByText('Médico')).toBeVisible();
  const creado = supabase.cambios.find((c) => c.metodo === 'POST')?.cuerpo as Record<
    string,
    unknown
  >;
  expect(creado).toMatchObject({ barbero: 'apu', motivo: 'Médico' });
  expect(String(creado.inicio)).toMatch(/T13:00:00-04:00$/);
});

test('registra a mano un corte y se suma al barbero', async ({ page }) => {
  const supabase = await simularAdmin(page);
  await entrar(page);
  await page
    .getByRole('button', { name: /Cortes/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Apu', exact: true }).click();
  await page.getByRole('button', { name: /Corte \+ barba \+ ceja/ }).click();
  await page.getByLabel(/Cliente/).fill('Mario');
  await page.getByRole('button', { name: 'Registrar corte · Bs 70' }).click();

  await expect(page.getByText('✂️ Corte + barba + ceja sumado a Apu')).toBeVisible();
  const deApu = page.getByRole('listitem').filter({ hasText: /^Apu/ });
  await expect(deApu).toContainText('1 corte');
  await expect(deApu).toContainText('Bs 70');
  await expect(page.getByText('Apu · Mario')).toBeVisible();
  expect(
    supabase.cambios.find((c) => c.ruta === '/rest/v1/rpc/registrar_corte')?.cuerpo,
  ).toMatchObject({
    p_barbero: 'apu',
    p_servicio: 'Corte + barba + ceja',
    p_duracion_min: 60,
    p_cliente: 'Mario',
  });
});

test('al cancelar una cita el cliente entra a la lista negra y se le pone penitencia', async ({
  page,
}) => {
  const supabase = await simularAdmin(page);
  await entrar(page);
  const deMicki = page.getByRole('region', { name: 'Citas de Micki' });
  await deMicki.getByRole('button', { name: '🚫 Cancelar' }).click();
  await deMicki.getByRole('button', { name: '¿Cancelar? Toca otra vez' }).click();
  await expect(deMicki.getByText('Cancelada', { exact: true })).toBeVisible();

  await page
    .getByRole('button', { name: /Lista negra/ })
    .first()
    .click();
  await expect(page.getByText('José Gómez')).toBeVisible();
  await expect(page.getByText('Canceló: Corte desde navaja con Micki')).toBeVisible();
  await page.getByLabel('Penitencia').fill('Paga por adelantado');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Penitencia guardada.')).toBeVisible();
  await expect
    .poll(() =>
      supabase.cambios.find((c) => c.metodo === 'PATCH' && c.ruta.includes('lista_negra')),
    )
    .toMatchObject({ cuerpo: { penitencia: 'Paga por adelantado' } });
});

test('agregar a mano a la lista negra marca sus próximas citas', async ({ page }) => {
  await simularAdmin(page);
  await entrar(page);
  await page
    .getByRole('button', { name: /Lista negra/ })
    .first()
    .click();
  await expect(page.getByText('Nadie en la lista negra.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '＋ Agregar a mano' }).click();
  await page.getByLabel('Cliente').fill('carlos perez');
  await page.getByLabel(/Motivo/).fill('Canceló por WhatsApp');
  await page.getByRole('button', { name: 'Agregar a la lista negra' }).click();
  await expect(page.getByText('Canceló por WhatsApp')).toBeVisible();

  await page.getByRole('button', { name: /Hoy/ }).first().click();
  await expect(
    page
      .getByRole('region', { name: 'Citas de Apu' })
      .getByText('🚷 En lista negra (1 cancelación)'),
  ).toBeVisible();
});

test('también se puede entrar con el correo completo', async ({ page }) => {
  const supabase = await simularAdmin(page);
  await entrar(page, 'clave-correcta', 'Dueno@Maick.test');
  await expect(page.getByRole('heading', { name: 'Hoy', exact: true })).toBeVisible();
  expect(supabase.correos).toEqual(['dueno@maick.test']);
});

test('una cuenta que no es administradora no ve nada', async ({ page }) => {
  await simularAdmin(page, { esAdmin: false });
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Esta cuenta no tiene acceso' })).toBeVisible();
  await expect(page.getByText('Carlos Pérez')).toHaveCount(0);
});
