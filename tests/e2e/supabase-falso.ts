import type { Page, Request, Route } from '@playwright/test';
import { ahoraEn, sumarDias } from '../../src/lib/tiempo';

const BASE = 'https://supabase.test/rest/v1/rpc';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** En los próximos 15 días, la hora 09:00–09:30 aparece ocupada para todos. */
export function ocupadosDeEjemplo() {
  const hoy = ahoraEn('America/La_Paz').fecha;
  return Array.from({ length: 15 }, (_, i) => {
    const fecha = sumarDias(hoy, i);
    return { inicio: `${fecha}T09:00:00-04:00`, fin: `${fecha}T09:30:00-04:00` };
  });
}

type Respuesta = { status?: number; json: unknown } | 'caida';

export interface SupabaseFalso {
  llamadas: { funcion: string; cuerpo: Record<string, unknown> }[];
}

/** Intercepta las llamadas a Supabase y responde con lo que diga cada prueba. */
export async function simularSupabase(
  page: Page,
  respuestas: {
    /** Recibe el cuerpo de la llamada (p_barbero, p_desde, p_hasta). */
    ocupados?: (cuerpo: Record<string, unknown>) => Respuesta;
    crear?: (cuerpo: Record<string, unknown>) => Respuesta;
  } = {},
): Promise<SupabaseFalso> {
  const estado: SupabaseFalso = { llamadas: [] };
  const responder = async (route: Route, request: Request, funcion: string, r: Respuesta) => {
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    estado.llamadas.push({ funcion, cuerpo: request.postDataJSON() as Record<string, unknown> });
    if (r === 'caida') return route.abort('connectionrefused');
    return route.fulfill({ status: r.status ?? 200, headers: CORS, json: r.json });
  };

  await page.route(`${BASE}/horarios_ocupados`, (route, request) =>
    responder(
      route,
      request,
      'horarios_ocupados',
      respuestas.ocupados?.(
        (request.method() === 'POST' ? request.postDataJSON() : {}) as Record<string, unknown>,
      ) ?? { json: ocupadosDeEjemplo() },
    ),
  );
  await page.route(`${BASE}/crear_reserva`, (route, request) => {
    const cuerpo = (request.method() === 'POST' ? request.postDataJSON() : {}) as Record<
      string,
      unknown
    >;
    return responder(
      route,
      request,
      'crear_reserva',
      respuestas.crear?.(cuerpo) ?? { json: [{ id: 'prueba', codigo: 'ABC123' }] },
    );
  });
  return estado;
}
