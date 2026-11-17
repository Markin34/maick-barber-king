import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUTA_PANEL } from '../../src/lib/panel';

describe('dirección del panel', () => {
  it('la página del panel toma su dirección de PANEL_RUTA', () => {
    expect(existsSync(new URL('../../src/pages/[panel].astro', import.meta.url))).toBe(true);
  });

  it('no es una dirección fácil de adivinar', () => {
    expect(RUTA_PANEL).toMatch(/^\/[a-z0-9-]{12,}$/);
    expect(['/admin', '/panel', '/dashboard', '/login']).not.toContain(RUTA_PANEL);
    expect(existsSync(new URL('../../src/pages/admin.astro', import.meta.url))).toBe(false);
  });
});
