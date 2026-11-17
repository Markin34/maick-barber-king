/**
 * Postgres en memoria (PGlite) con lo mínimo que Supabase trae de fábrica:
 * roles anon/authenticated, el esquema auth y auth.uid() leyendo el usuario de la sesión.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const migracion = (nombre: string) =>
  readFileSync(new URL(`../../supabase/migrations/${nombre}`, import.meta.url), 'utf8');

export const MIGRACIONES = ['0001_reservas.sql', '0002_admin.sql'] as const;

export async function crearBase(migraciones: readonly string[] = MIGRACIONES): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    grant usage on schema auth to anon, authenticated;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  `);
  for (const m of migraciones) await db.exec(migracion(m));
  return db;
}

/** Corre una función como un usuario con sesión (o como cliente anónimo si no hay userId). */
export async function como<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    userId ? `set role authenticated; set request.jwt.claim.sub = '${userId}';` : 'set role anon;',
  );
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; reset request.jwt.claim.sub;`);
  }
}

export async function errorDe(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
    return 'SIN_ERROR';
  } catch (e) {
    return (e as Error).message;
  }
}
