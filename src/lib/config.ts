import type { ConfigSupabase } from './reservas-api';

/**
 * Lee la conexión a Supabase de las variables de entorno al construir la página.
 * Sin variables → undefined (la página funciona solo con WhatsApp).
 * Variables a medias o mal escritas → error de build, para no publicar algo roto.
 */
export function configSupabase(
  env: { PUBLIC_SUPABASE_URL?: string; PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string } = import.meta.env,
): ConfigSupabase | undefined {
  const url = env.PUBLIC_SUPABASE_URL?.trim();
  const clave = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url && !clave) return undefined;
  if (!url || !clave) {
    throw new Error(
      'Falta una variable de Supabase. Pon las dos (PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_PUBLISHABLE_KEY) o ninguna.',
    );
  }
  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    throw new Error(`PUBLIC_SUPABASE_URL no es una dirección válida: "${url}"`);
  }
  if (direccion.protocol !== 'https:' && direccion.hostname !== 'localhost') {
    throw new Error('PUBLIC_SUPABASE_URL debe empezar con https://');
  }
  if (clave.startsWith('sb_secret_') || clave.includes('service_role')) {
    throw new Error(
      'Pusiste la clave SECRETA de Supabase. Usa la clave pública (publishable o anon); la secreta nunca va en la página.',
    );
  }
  return { url: direccion.origin, clave };
}
