interface ImportMetaEnv {
  /** URL del proyecto de Supabase, por ejemplo https://abcd1234.supabase.co */
  readonly PUBLIC_SUPABASE_URL?: string;
  /** Clave pública (publishable o anon). Es segura en el navegador: solo puede usar las funciones de reserva. */
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
