import type { Page, Route } from '@playwright/test';
import { ahoraEn } from '../../src/lib/tiempo';

const BASE = 'https://supabase.test';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range',
};

export const DUENO = { id: '11111111-1111-1111-1111-111111111111', email: 'dueno@maick.test' };

export function reservasDeHoy() {
  const hoy = ahoraEn('America/La_Paz').fecha;
  return [
    {
      id: 'r1',
      codigo: 'AAA111',
      barbero: 'apu',
      servicio: 'Corte + barba',
      inicio: `${hoy}T18:00:00-04:00`,
      fin: `${hoy}T19:00:00-04:00`,
      cliente: 'Carlos Pérez',
      nota: 'Primera vez',
      estado: 'confirmada',
      creada_en: `${hoy}T10:00:00-04:00`,
    },
    {
      id: 'r2',
      codigo: 'BBB222',
      barbero: 'micki',
      servicio: 'Corte desde navaja',
      inicio: `${hoy}T19:00:00-04:00`,
      fin: `${hoy}T19:45:00-04:00`,
      cliente: 'José Gómez',
      nota: null,
      estado: 'confirmada',
      creada_en: `${hoy}T11:00:00-04:00`,
    },
  ];
}

export interface AdminFalso {
  cambios: { metodo: string; ruta: string; cuerpo: unknown }[];
  /** Correos con los que se intentó entrar. */
  correos: string[];
}

/** Simula Supabase Auth + base de datos para el panel. */
export async function simularAdmin(
  page: Page,
  opciones: { esAdmin?: boolean; claveCorrecta?: string } = {},
): Promise<AdminFalso> {
  const { esAdmin = true, claveCorrecta = 'clave-correcta' } = opciones;
  const estado: AdminFalso = { cambios: [], correos: [] };
  const creadas: (ReturnType<typeof reservasDeHoy>[number] & { origen: string })[] = [];
  let lista: {
    id: string;
    reserva_id: string | null;
    cliente: string;
    barbero: string | null;
    servicio: string | null;
    cita_inicio: string | null;
    motivo: string;
    penitencia: string | null;
    creado_en: string;
  }[] = [];
  const responder = (route: Route, status: number, json: unknown) =>
    route.fulfill({ status, headers: CORS, json });

  await page.route(`${BASE}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const ruta = url.pathname;

    if (ruta === '/auth/v1/token') {
      const cuerpo = req.postDataJSON() as { email?: string; password?: string };
      // Supabase renueva la sesión sola cada hora con el refresh_token (sin contraseña).
      const renovando = url.searchParams.get('grant_type') === 'refresh_token';
      if (!renovando) estado.correos.push(cuerpo.email ?? '');
      if (!renovando && cuerpo.password !== claveCorrecta) {
        return responder(route, 400, {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        });
      }
      const ahora = Math.floor(Date.now() / 1000);
      return responder(route, 200, {
        access_token: 'token-de-prueba',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: ahora + 3600,
        refresh_token: 'refresco',
        user: {
          id: DUENO.id,
          email: DUENO.email,
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      });
    }
    if (ruta === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    if (ruta === '/rest/v1/rpc/es_admin') return responder(route, 200, esAdmin);

    if (ruta === '/rest/v1/reservas' && req.method() === 'GET') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const filas = [...reservasDeHoy(), ...creadas];
      return id
        ? responder(
            route,
            200,
            filas.find((f) => f.id === id),
          )
        : responder(route, 200, filas);
    }
    if (ruta === '/rest/v1/rpc/registrar_corte') {
      const p = req.postDataJSON() as Record<string, string | number | null>;
      estado.cambios.push({ metodo: 'POST', ruta, cuerpo: p });
      const id = `m${creadas.length + 1}`;
      const fin = new Date(
        new Date(`${p.p_fecha}T${p.p_hora}:00-04:00`).getTime() + Number(p.p_duracion_min) * 60000,
      );
      creadas.push({
        id,
        codigo: `MAN00${creadas.length + 1}`,
        barbero: String(p.p_barbero),
        servicio: String(p.p_servicio),
        inicio: `${p.p_fecha}T${p.p_hora}:00-04:00`,
        fin: fin.toISOString(),
        cliente: p.p_cliente ? String(p.p_cliente) : 'Cliente en local',
        nota: null,
        estado: 'asistio',
        creada_en: new Date().toISOString(),
        origen: 'manual',
      });
      return responder(route, 200, [{ id, codigo: 'MAN001' }]);
    }
    if (ruta === '/rest/v1/bloqueos' && req.method() === 'GET') return responder(route, 200, []);
    if (ruta === '/rest/v1/lista_negra' && req.method() === 'GET')
      return responder(route, 200, lista);

    estado.cambios.push({
      metodo: req.method(),
      ruta: `${ruta}${url.search}`,
      cuerpo: req.postDataJSON(),
    });
    if (ruta === '/rest/v1/reservas' && req.method() === 'PATCH') {
      // Igual que el trigger de 0004: al cancelar, el cliente entra a la lista negra.
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      const r = reservasDeHoy().find((f) => f.id === id);
      const cuerpo = req.postDataJSON() as { estado?: string };
      if (r && cuerpo.estado === 'cancelada' && !lista.some((f) => f.reserva_id === id)) {
        lista.unshift({
          id: `ln-${id}`,
          reserva_id: r.id,
          cliente: r.cliente,
          barbero: r.barbero,
          servicio: r.servicio,
          cita_inicio: r.inicio,
          motivo: 'Canceló su cita',
          penitencia: null,
          creado_en: new Date().toISOString(),
        });
      }
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (ruta === '/rest/v1/lista_negra') {
      const id = url.searchParams.get('id')?.replace(/^eq\./, '');
      if (req.method() === 'PATCH') {
        const fila = lista.find((f) => f.id === id);
        if (fila) Object.assign(fila, req.postDataJSON());
        return route.fulfill({ status: 204, headers: CORS });
      }
      if (req.method() === 'DELETE') {
        lista = lista.filter((f) => f.id !== id);
        return route.fulfill({ status: 204, headers: CORS });
      }
      if (req.method() === 'POST') {
        const fila = {
          id: `ln-manual-${lista.length}`,
          reserva_id: null,
          barbero: null,
          servicio: null,
          cita_inicio: null,
          creado_en: new Date().toISOString(),
          ...(req.postDataJSON() as { cliente: string; motivo: string; penitencia: string | null }),
        };
        lista.unshift(fila);
        return responder(route, 201, fila);
      }
    }
    if (ruta === '/rest/v1/bloqueos' && req.method() === 'POST') {
      const b = req.postDataJSON() as Record<string, unknown>;
      return responder(route, 201, { id: 'b1', ...b });
    }
    if (ruta === '/rest/v1/bloqueos' && req.method() === 'DELETE')
      return route.fulfill({ status: 204, headers: CORS });
    return responder(route, 404, { message: `Ruta no simulada: ${ruta}` });
  });
  return estado;
}
