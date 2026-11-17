import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ConfigSupabase } from '../../../lib/reservas-api';

const CLAVE_SESION = 'mbk-admin-sesion';

let cliente: SupabaseClient | undefined;

/**
 * Un solo cliente para todo el panel.
 * La sesión vive solo en esta pestaña (sessionStorage): al cerrar la pestaña o el navegador,
 * el panel vuelve a pedir usuario y contraseña.
 */
export function clienteSupabase(config: ConfigSupabase): SupabaseClient {
  if (!cliente) {
    // Versiones anteriores guardaban la sesión para siempre en localStorage: se borra.
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      // Navegador sin almacenamiento: no hay nada que borrar.
    }
    cliente = createClient(config.url, config.clave, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: CLAVE_SESION,
        storage: typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
      },
    });
  }
  return cliente;
}
