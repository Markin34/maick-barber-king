import type {
  RealtimePostgresChangesPayload,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  aCita,
  aInstante,
  type Cita,
  type EstadoReserva,
  type FilaBloqueo,
  type FilaReserva,
} from '../../../lib/admin';
import { ahoraEn, sumarDias } from '../../../lib/tiempo';

// ---------------------------------------------------------------------------
// Sesión del dueño
// ---------------------------------------------------------------------------

export type EstadoSesion =
  | { estado: 'cargando' }
  | { estado: 'fuera' }
  | { estado: 'sin-acceso'; sesion: Session }
  | { estado: 'admin'; sesion: Session };

export function useSesion(supabase: SupabaseClient): EstadoSesion {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  const [permiso, setPermiso] = useState<{ userId: string; esAdmin: boolean }>();

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => vivo && setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s));
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const userId = sesion?.user.id;
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    supabase.rpc('es_admin').then(({ data, error }) => {
      if (vivo) setPermiso({ userId, esAdmin: !error && data === true });
    });
    return () => {
      vivo = false;
    };
  }, [supabase, userId]);

  if (sesion === undefined) return { estado: 'cargando' };
  if (sesion === null) return { estado: 'fuera' };
  if (permiso?.userId !== sesion.user.id) return { estado: 'cargando' };
  return permiso.esAdmin ? { estado: 'admin', sesion } : { estado: 'sin-acceso', sesion };
}

// ---------------------------------------------------------------------------
// Datos del panel: reservas y bloqueos, con actualización en vivo
// ---------------------------------------------------------------------------

/** Cuánto historial y cuánto futuro se carga (alcanza para el resumen del mes y la agenda). */
const DIAS_ATRAS = 62;
const DIAS_ADELANTE = 62;

export interface NuevoBloqueo {
  barbero: string | null;
  fecha: string;
  desde: string;
  hasta: string;
  motivo: string;
}

export interface NuevoCorte {
  barbero: string;
  servicio: string;
  duracionMin: number;
  fecha: string;
  hora: string;
  cliente: string;
}

const COLUMNAS_RESERVA =
  'id,codigo,barbero,servicio,inicio,fin,cliente,nota,estado,creada_en,origen';

export interface DatosAdmin {
  estado: 'cargando' | 'listo' | 'error';
  citas: Cita[];
  bloqueos: FilaBloqueo[];
  enVivo: boolean;
  /** ids de reservas que llegaron mientras el panel estaba abierto (para resaltarlas). */
  recientes: ReadonlySet<string>;
  recargar: () => void;
  cambiarEstado: (id: string, estado: EstadoReserva) => Promise<void>;
  /** Borra la cita por completo (también sale de la lista negra). */
  eliminarCita: (id: string) => Promise<void>;
  crearBloqueo: (b: NuevoBloqueo) => Promise<void>;
  borrarBloqueo: (id: string) => Promise<void>;
  registrarCorte: (c: NuevoCorte) => Promise<void>;
}

export function useDatosAdmin(supabase: SupabaseClient, zona: string): DatosAdmin {
  const [version, setVersion] = useState(0);
  const [carga, setCarga] = useState<{ version: number; error: boolean }>();
  const [filas, setFilas] = useState<FilaReserva[]>([]);
  const [bloqueos, setBloqueos] = useState<FilaBloqueo[]>([]);
  const [enVivo, setEnVivo] = useState(false);
  const [recientes, setRecientes] = useState<ReadonlySet<string>>(new Set());

  // Carga inicial (y cada vez que se pide recargar).
  useEffect(() => {
    let vivo = true;
    const hoy = ahoraEn(zona).fecha;
    const desde = aInstante(sumarDias(hoy, -DIAS_ATRAS), '00:00');
    const hasta = aInstante(sumarDias(hoy, DIAS_ADELANTE), '23:59');
    Promise.all([
      supabase
        .from('reservas')
        .select(COLUMNAS_RESERVA)
        .gte('inicio', desde)
        .lte('inicio', hasta)
        .order('inicio'),
      supabase
        .from('bloqueos')
        .select('id,barbero,inicio,fin,motivo')
        .gte('fin', aInstante(hoy, '00:00'))
        .order('inicio'),
    ]).then(([r, b]) => {
      if (!vivo) return;
      if (r.error || b.error) {
        setCarga({ version, error: true });
        return;
      }
      setFilas(r.data as FilaReserva[]);
      setBloqueos(b.data as FilaBloqueo[]);
      setCarga({ version, error: false });
    });
    return () => {
      vivo = false;
    };
  }, [supabase, zona, version]);

  // Reservas nuevas o cambiadas en vivo.
  useEffect(() => {
    const canal = supabase
      .channel('panel-reservas')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        (cambio: RealtimePostgresChangesPayload<FilaReserva>) => {
          if (cambio.eventType === 'DELETE') {
            const id = (cambio.old as Partial<FilaReserva>).id;
            setFilas((actual) => actual.filter((f) => f.id !== id));
            return;
          }
          const fila = cambio.new as FilaReserva;
          setFilas((actual) =>
            actual.some((f) => f.id === fila.id)
              ? actual.map((f) => (f.id === fila.id ? fila : f))
              : [...actual, fila],
          );
          if (cambio.eventType === 'INSERT' && fila.origen !== 'manual')
            setRecientes((r) => new Set(r).add(fila.id));
        },
      )
      .subscribe((estado) => setEnVivo(estado === 'SUBSCRIBED'));
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [supabase]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const cambiarEstado = useCallback(
    async (id: string, estado: EstadoReserva) => {
      let anterior: EstadoReserva | undefined;
      // Optimista: se ve al instante; si falla, se vuelve atrás.
      setFilas((actual) =>
        actual.map((f) => {
          if (f.id !== id) return f;
          anterior = f.estado;
          return { ...f, estado };
        }),
      );
      const { error } = await supabase.from('reservas').update({ estado }).eq('id', id);
      if (error) {
        setFilas((actual) =>
          actual.map((f) => (f.id === id && anterior ? { ...f, estado: anterior } : f)),
        );
        throw new Error('No se pudo cambiar la cita. Revisa tu internet.');
      }
    },
    [supabase],
  );

  const eliminarCita = useCallback(
    async (id: string) => {
      // Se pide la fila borrada de vuelta: si la base no dejó borrar (sin permiso),
      // no hay error pero vuelve vacía, y así no se finge un borrado que no pasó.
      const { data, error } = await supabase.from('reservas').delete().eq('id', id).select('id');
      if (error || !data?.length) throw new Error('No se pudo eliminar la cita. Revisa tu internet.');
      setFilas((actual) => actual.filter((f) => f.id !== id));
    },
    [supabase],
  );

  const crearBloqueo = useCallback(
    async (b: NuevoBloqueo) => {
      const { data, error } = await supabase
        .from('bloqueos')
        .insert({
          barbero: b.barbero,
          inicio: aInstante(b.fecha, b.desde),
          fin: aInstante(b.fecha, b.hasta),
          motivo: b.motivo.trim() || null,
        })
        .select('id,barbero,inicio,fin,motivo')
        .single();
      if (error)
        throw new Error(
          'No se pudo guardar el bloqueo. Revisa que "hasta" sea después de "desde".',
        );
      setBloqueos((actual) =>
        [...actual, data as FilaBloqueo].sort((x, y) => x.inicio.localeCompare(y.inicio)),
      );
    },
    [supabase],
  );

  const borrarBloqueo = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('bloqueos').delete().eq('id', id);
      if (error) throw new Error('No se pudo quitar el bloqueo.');
      setBloqueos((actual) => actual.filter((b) => b.id !== id));
    },
    [supabase],
  );

  const registrarCorte = useCallback(
    async (c: NuevoCorte) => {
      const { data, error } = await supabase.rpc('registrar_corte', {
        p_barbero: c.barbero,
        p_servicio: c.servicio,
        p_fecha: c.fecha,
        p_hora: c.hora,
        p_duracion_min: c.duracionMin,
        p_cliente: c.cliente.trim() || null,
      });
      const id = (data as { id: string }[] | null)?.[0]?.id;
      if (error || !id) throw new Error('No se pudo registrar el corte. Revisa tu internet.');
      // No esperamos al aviso en vivo: se trae la fila recién creada y se agrega a la lista.
      const fila = await supabase.from('reservas').select(COLUMNAS_RESERVA).eq('id', id).single();
      if (fila.error) {
        setVersion((v) => v + 1);
        return;
      }
      const nueva = fila.data as FilaReserva;
      setFilas((actual) => (actual.some((f) => f.id === nueva.id) ? actual : [...actual, nueva]));
    },
    [supabase],
  );

  const citas = useMemo(() => filas.map((f) => aCita(f, zona)), [filas, zona]);
  const estado = carga?.version !== version ? 'cargando' : carga.error ? 'error' : 'listo';

  // Objeto estable mientras nada cambie: así las tarjetas memorizadas no se redibujan de más.
  return useMemo(
    () => ({
      estado,
      citas,
      bloqueos,
      enVivo,
      recientes,
      recargar,
      cambiarEstado,
      eliminarCita,
      crearBloqueo,
      borrarBloqueo,
      registrarCorte,
    }),
    [
      eliminarCita,
      registrarCorte,
      estado,
      citas,
      bloqueos,
      enVivo,
      recientes,
      recargar,
      cambiarEstado,
      crearBloqueo,
      borrarBloqueo,
    ],
  );
}
