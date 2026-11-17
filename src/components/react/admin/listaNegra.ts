import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { vecesEnListaNegra, type FilaListaNegra } from '../../../lib/admin';

const COLUMNAS = 'id,reserva_id,cliente,barbero,servicio,cita_inicio,motivo,penitencia,creado_en';

export interface NuevoEnLista {
  cliente: string;
  motivo: string;
  penitencia: string;
}

export interface ListaNegra {
  estado: 'cargando' | 'listo' | 'error';
  filas: FilaListaNegra[];
  /** Veces que cada cliente (nombre normalizado) está en la lista. */
  veces: ReadonlyMap<string, number>;
  recargar: () => void;
  agregar: (n: NuevoEnLista) => Promise<void>;
  cambiarPenitencia: (id: string, penitencia: string) => Promise<void>;
  quitar: (id: string) => Promise<void>;
}

/**
 * Lista negra del panel. Si falla (por ejemplo, falta correr la migración 0004),
 * el resto del panel sigue funcionando y esta sección muestra el error.
 */
export function useListaNegra(supabase: SupabaseClient): ListaNegra {
  const [clave, setVersion] = useState(0);
  const [carga, setCarga] = useState<{ clave: number; error: boolean }>();
  const [filas, setFilas] = useState<FilaListaNegra[]>([]);

  useEffect(() => {
    let vivo = true;
    supabase
      .from('lista_negra')
      .select(COLUMNAS)
      .order('creado_en', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (!vivo) return;
        if (!error) setFilas(data as FilaListaNegra[]);
        setCarga({ clave, error: Boolean(error) });
      });
    return () => {
      vivo = false;
    };
  }, [supabase, clave]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const agregar = useCallback(
    async (n: NuevoEnLista) => {
      const { data, error } = await supabase
        .from('lista_negra')
        .insert({
          cliente: n.cliente.trim().replace(/\s+/g, ' '),
          motivo: n.motivo.trim() || 'Agregado por el dueño',
          penitencia: n.penitencia.trim() || null,
        })
        .select(COLUMNAS)
        .single();
      if (error) throw new Error('No se pudo agregar a la lista negra. Revisa el nombre.');
      setFilas((actual) => [data as FilaListaNegra, ...actual]);
    },
    [supabase],
  );

  const cambiarPenitencia = useCallback(
    async (id: string, penitencia: string) => {
      const texto = penitencia.trim() || null;
      const { error } = await supabase
        .from('lista_negra')
        .update({ penitencia: texto })
        .eq('id', id);
      if (error) throw new Error('No se pudo guardar la penitencia. Revisa tu internet.');
      setFilas((actual) => actual.map((f) => (f.id === id ? { ...f, penitencia: texto } : f)));
    },
    [supabase],
  );

  const quitar = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('lista_negra').delete().eq('id', id);
      if (error) throw new Error('No se pudo quitar de la lista negra.');
      setFilas((actual) => actual.filter((f) => f.id !== id));
    },
    [supabase],
  );

  const veces = useMemo(() => vecesEnListaNegra(filas), [filas]);
  const estado = carga?.clave !== clave ? 'cargando' : carga.error ? 'error' : 'listo';

  return useMemo(
    () => ({ estado, filas, veces, recargar, agregar, cambiarPenitencia, quitar }),
    [estado, filas, veces, recargar, agregar, cambiarPenitencia, quitar],
  );
}
