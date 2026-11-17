/**
 * Respaldo de la base de datos de Supabase.
 *
 * Descarga todas las tablas importantes y las guarda en respaldos/AAAA-MM-DD.json.
 * Uso:  npm run respaldo
 *
 * Necesita en el archivo .env (NUNCA en Vercel ni en variables PUBLIC_):
 *   PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Project Settings → API → service_role / secret)
 *
 * La clave secreta salta todos los permisos: guárdala solo en tu compu.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const TABLAS = [
  'reservas',
  'bloqueos',
  'lista_negra',
  'administradores',
  'catalogo_reglas',
  'catalogo_servicios',
  'catalogo_barbero_servicios',
  'catalogo_horarios',
  'errores_web',
];
const POR_PAGINA = 1000;

const url = process.env.PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error(
    'Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env.\n' +
      'La clave está en Supabase → Project Settings → API (service_role / secret).',
  );
  process.exit(1);
}

async function descargarTabla(tabla) {
  const filas = [];
  for (let desde = 0; ; desde += POR_PAGINA) {
    const respuesta = await fetch(`${url}/rest/v1/${tabla}?select=*`, {
      headers: {
        apikey: clave,
        // Las claves viejas (JWT, empiezan con "eyJ") también van como Bearer; las nuevas sb_secret_ no.
        ...(clave.startsWith('eyJ') ? { Authorization: `Bearer ${clave}` } : {}),
        Range: `${desde}-${desde + POR_PAGINA - 1}`,
        'Range-Unit': 'items',
      },
    });
    if (respuesta.status === 404) return null; // la tabla aún no existe (migración sin correr)
    if (!respuesta.ok) {
      throw new Error(`${tabla}: ${respuesta.status} ${await respuesta.text()}`);
    }
    const pagina = await respuesta.json();
    filas.push(...pagina);
    if (pagina.length < POR_PAGINA) return filas;
  }
}

const respaldo = { creado: new Date().toISOString(), origen: url, tablas: {} };
for (const tabla of TABLAS) {
  const filas = await descargarTabla(tabla);
  if (filas === null) {
    console.log(`  ${tabla}: no existe, se salta`);
    continue;
  }
  respaldo.tablas[tabla] = filas;
  console.log(`  ${tabla}: ${filas.length} filas`);
}

const carpeta = 'respaldos';
await mkdir(carpeta, { recursive: true });
// Fecha de Bolivia (no UTC), en formato AAAA-MM-DD.
const fecha = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/La_Paz' });
const archivo = join(carpeta, `${fecha}.json`);
await writeFile(archivo, JSON.stringify(respaldo, null, 2));
console.log(`\nRespaldo guardado en ${archivo}`);
