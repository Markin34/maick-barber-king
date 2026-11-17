import { useEffect, useState } from 'react';
import { agruparOcupados, type OcupadosPorFecha } from '../../../lib/horarios';
import { obtenerOcupados, type ConfigSupabase } from '../../../lib/reservas-api';
import { ahoraEn, sumarDias, type Ahora } from '../../../lib/tiempo';

/** Hora de la barbería, actualizada cada minuto para no ofrecer horas que ya pasaron. */
export function useAhora(zonaHoraria: string): Ahora {
  const [ahora, setAhora] = useState(() => ahoraEn(zonaHoraria));
  useEffect(() => {
    const id = window.setInterval(() => setAhora(ahoraEn(zonaHoraria)), 60_000);
    return () => window.clearInterval(id);
  }, [zonaHoraria]);
  return ahora;
}

export type CargaOcupados =
  | { estado: 'inactivo' }
  | { estado: 'cargando' }
  | { estado: 'error' }
  | { estado: 'listo'; ocupados: OcupadosPorFecha };

type Resultado = { clave: string } & (
  { estado: 'error' } | { estado: 'listo'; ocupados: OcupadosPorFecha }
);

/**
 * Pide a Supabase las horas ocupadas de un barbero.
 *
 * El estado "cargando" se deriva: si la última respuesta no corresponde a la consulta actual
 * (otro barbero u otra versión), todavía estamos esperando. Así no hay setState dentro del efecto
 * y una respuesta vieja nunca pisa a una nueva.
 */
export function useOcupados(params: {
  config?: ConfigSupabase;
  barberoId?: string;
  zonaHoraria: string;
  dias: number;
  version: number;
}): CargaOcupados {
  const { config, barberoId, zonaHoraria, dias, version } = params;
  const clave = config && barberoId ? `${barberoId}|${version}` : null;
  const [resultado, setResultado] = useState<Resultado>();

  useEffect(() => {
    if (!config || !barberoId || !clave) return;
    const control = new AbortController();
    const hoy = ahoraEn(zonaHoraria).fecha;
    obtenerOcupados(config, barberoId, hoy, sumarDias(hoy, dias - 1), control.signal)
      .then((intervalos) =>
        setResultado({
          clave,
          estado: 'listo',
          ocupados: agruparOcupados(intervalos, zonaHoraria),
        }),
      )
      .catch(() => {
        if (!control.signal.aborted) setResultado({ clave, estado: 'error' });
      });
    return () => control.abort();
  }, [config, barberoId, clave, zonaHoraria, dias]);

  if (!clave) return { estado: 'inactivo' };
  if (resultado?.clave !== clave) return { estado: 'cargando' };
  return resultado;
}

/**
 * Horas ocupadas de varios barberos a la vez (para mostrar en la lista quién está libre).
 * Devuelve undefined mientras carga o si falla: es solo una ayuda, la reserva no depende de esto.
 */
export function useOcupadosDeTodos(params: {
  config?: ConfigSupabase;
  barberoIds: readonly string[];
  zonaHoraria: string;
  dias: number;
  activo: boolean;
}): ReadonlyMap<string, OcupadosPorFecha> | undefined {
  const { config, barberoIds, zonaHoraria, dias, activo } = params;
  const clave = config && activo ? barberoIds.join(',') : null;
  const [resultado, setResultado] = useState<{
    clave: string;
    porBarbero: Map<string, OcupadosPorFecha>;
  }>();

  useEffect(() => {
    if (!config || !clave) return;
    const control = new AbortController();
    const hoy = ahoraEn(zonaHoraria).fecha;
    const hasta = sumarDias(hoy, dias - 1);
    const ids = clave.split(',');
    Promise.all(ids.map((id) => obtenerOcupados(config, id, hoy, hasta, control.signal)))
      .then((listas) =>
        setResultado({
          clave,
          porBarbero: new Map(ids.map((id, i) => [id, agruparOcupados(listas[i]!, zonaHoraria)])),
        }),
      )
      .catch(() => {
        // Sin datos se muestra la lista normal, sin la hora libre.
      });
    return () => control.abort();
  }, [config, clave, zonaHoraria, dias]);

  return clave && resultado?.clave === clave ? resultado.porBarbero : undefined;
}
