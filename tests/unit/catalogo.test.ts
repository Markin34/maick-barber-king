/**
 * supabase/catalogo.sql tiene que coincidir con src/data.
 * Si esta prueba falla, corre `npm run catalogo` y vuelve a pegar el archivo en Supabase.
 */
import { describe, expect, it } from 'vitest';
import { catalogo } from '../../src/data';
import { catalogoSql } from '../../src/lib/catalogo-sql';

describe('catálogo para Supabase', () => {
  it('supabase/catalogo.sql está al día con src/data (si falla: npm run catalogo)', async () => {
    await expect(catalogoSql(catalogo)).toMatchFileSnapshot('../../supabase/catalogo.sql');
  });

  it('escapa comillas en los nombres', () => {
    const sql = catalogoSql({
      ...catalogo,
      servicios: [{ ...catalogo.servicios[0]!, nombre: "Corte O'Neil" }],
      barberos: [{ ...catalogo.barberos[0]!, servicios: undefined }],
    });
    expect(sql).toContain("'Corte O''Neil'");
  });
});
