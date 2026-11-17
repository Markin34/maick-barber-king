/**
 * Supabase necesita un correo para iniciar sesión. Para que el dueño entre escribiendo solo
 * "admin", un usuario sin "@" se convierte en un correo interno de la barbería.
 * Ese correo no tiene que existir: el usuario se crea en Supabase con "Auto Confirm User".
 */
export const DOMINIO_USUARIOS = 'maickbarberking.com';

/** "admin" → "admin@maickbarberking.com"; un correo completo queda igual. */
export function correoDeUsuario(entrada: string): string {
  const limpio = entrada.trim().toLowerCase();
  return limpio.includes('@') ? limpio : `${limpio}@${DOMINIO_USUARIOS}`;
}
