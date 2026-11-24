/**
 * Panel del dueño (dirección secreta en src/lib/panel.ts). Solo entra quien inicia sesión Y está en la tabla `administradores`.
 * La base de datos es la que protege los datos (RLS); este componente solo muestra lo que puede ver.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AnimatePresence, m } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EstadoReserva } from '../../../lib/admin';
import type { ConfigSupabase } from '../../../lib/reservas-api';
import { Movimiento } from '../comun/Movimiento';
import { TOQUE } from '../comun/animaciones';
import { Panel, type BarberoPanel, type ContextoPanel, type ServicioPanel } from './contexto';
import { useDatosAdmin, useSesion } from './hooks';
import { Ingreso } from './Ingreso';
import { useListaNegra } from './listaNegra';
import { clienteSupabase } from './supabase';
import { VistaCortes } from './VistaCortes';
import { VistaListaNegra } from './VistaListaNegra';
import { VistaAgenda, VistaBloqueos, VistaHoy, VistaResumen } from './Vistas';

interface Props {
  supabase?: ConfigSupabase;
  negocio: string;
  zona: string;
  barberos: BarberoPanel[];
  servicios: ServicioPanel[];
  precios: Record<string, number>;
}

const SECCIONES = [
  { id: 'hoy', texto: 'Hoy', icono: '☀️' },
  { id: 'cortes', texto: 'Cortes', icono: '✂️' },
  { id: 'agenda', texto: 'Agenda', icono: '📅' },
  { id: 'bloqueos', texto: 'Bloqueos', icono: '⛔' },
  { id: 'resumen', texto: 'Resumen', icono: '📊' },
  { id: 'lista-negra', texto: 'Lista negra', icono: '🚷' },
] as const;
type Seccion = (typeof SECCIONES)[number]['id'];
function Centro({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[60svh] items-center justify-center py-10">{children}</div>;
}

function Tablero({ cliente, ...p }: Props & { cliente: SupabaseClient }) {
  const datos = useDatosAdmin(cliente, p.zona);
  const [seccion, setSeccion] = useState<Seccion>('hoy');
  const [aviso, setAviso] = useState<{ id: number; texto: string }>();
  const reloj = useRef<number>(undefined);

  const avisar = useCallback((texto: string) => {
    setAviso({ id: Date.now(), texto });
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => setAviso(undefined), 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(reloj.current), []);

  // Aviso cuando entra una reserva nueva con el panel abierto.
  const cantidadNuevas = datos.recientes.size;
  const anteriores = useRef(cantidadNuevas);
  useEffect(() => {
    if (cantidadNuevas > anteriores.current) avisar('🔔 Entró una reserva nueva');
    anteriores.current = cantidadNuevas;
  }, [cantidadNuevas, avisar]);

  const listaNegra = useListaNegra(cliente);
  const { recargar: recargarLista } = listaNegra;
  // Al cancelar (o deshacer una cancelación) la base agrega o saca al cliente de la lista negra.
  const datosConLista = useMemo(
    () => ({
      ...datos,
      cambiarEstado: async (id: string, estado: EstadoReserva) => {
        const antes = datos.citas.find((c) => c.id === id)?.estado;
        await datos.cambiarEstado(id, estado);
        if (estado === 'cancelada' || antes === 'cancelada') recargarLista();
      },
      // Si la cita estaba en la lista negra, la base la saca sola al borrarla.
      eliminarCita: async (id: string) => {
        await datos.eliminarCita(id);
        recargarLista();
      },
    }),
    [datos, recargarLista],
  );

  const { precios, barberos, servicios } = p;
  const contexto = useMemo<ContextoPanel>(
    () => ({
      zona: p.zona,
      negocio: p.negocio,
      barberos,
      servicios,
      precioDe: (servicio) => precios[servicio] ?? 0,
      apodoDe: (id) => (id ? (barberos.find((b) => b.id === id)?.apodo ?? id) : 'Todos'),
      datos: datosConLista,
      listaNegra,
      avisar,
    }),
    [p.zona, p.negocio, barberos, servicios, precios, datosConLista, listaNegra, avisar],
  );

  return (
    <Panel value={contexto}>
      <div className="flex flex-col gap-6 pb-28 md:pb-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`size-2.5 rounded-full ${datos.enVivo ? 'bg-wa animate-pulse' : 'bg-borde'}`}
              aria-hidden="true"
            />
            <span className="text-gris">{datos.enVivo ? 'En vivo' : 'Conectando…'}</span>
          </div>
          <nav
            aria-label="Secciones del panel"
            className="bg-panel-2 hidden rounded-full p-1 md:flex"
          >
            {SECCIONES.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-current={seccion === s.id ? 'page' : undefined}
                onClick={() => setSeccion(s.id)}
                className={`relative isolate rounded-full px-4 py-2 text-sm font-semibold ${seccion === s.id ? 'text-fondo' : 'text-gris'}`}
              >
                {seccion === s.id && (
                  <m.span
                    layoutId="seccion"
                    className="bg-texto absolute inset-0 -z-10 rounded-full"
                  />
                )}
                {s.texto}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className="text-gris hover:text-texto text-sm font-semibold underline"
            onClick={() => void cliente.auth.signOut()}
          >
            Cerrar sesión
          </button>
        </header>

        {datos.estado === 'error' ? (
          <div className="tarjeta flex flex-col items-start gap-3 p-5" role="alert">
            <p>No pudimos cargar las reservas. Revisa tu internet.</p>
            <button type="button" className="btn-principal" onClick={datos.recargar}>
              Reintentar
            </button>
          </div>
        ) : datos.estado === 'cargando' && datos.citas.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="bg-panel-2 h-24 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={seccion}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {seccion === 'hoy' && <VistaHoy />}
              {seccion === 'cortes' && <VistaCortes />}
              {seccion === 'agenda' && <VistaAgenda />}
              {seccion === 'bloqueos' && <VistaBloqueos />}
              {seccion === 'resumen' && <VistaResumen />}
              {seccion === 'lista-negra' && <VistaListaNegra />}
            </m.div>
          </AnimatePresence>
        )}
      </div>

      {/* Menú inferior en celular */}
      <nav
        aria-label="Secciones del panel"
        className="border-borde bg-fondo/95 fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {SECCIONES.map((s) => (
          <m.button
            key={s.id}
            type="button"
            whileTap={TOQUE}
            aria-current={seccion === s.id ? 'page' : undefined}
            onClick={() => setSeccion(s.id)}
            className={`relative flex flex-col items-center gap-0.5 px-0.5 py-2.5 text-center text-[11px] leading-tight font-semibold ${seccion === s.id ? 'text-laton' : 'text-gris'}`}
          >
            {seccion === s.id && (
              <m.span
                layoutId="seccion-movil"
                className="bg-laton absolute top-0 h-0.5 w-10 rounded-full"
              />
            )}
            <span className="text-lg" aria-hidden="true">
              {s.icono}
            </span>
            {s.texto}
          </m.button>
        ))}
      </nav>

      <AnimatePresence>
        {aviso && (
          <m.p
            key={aviso.id}
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-texto fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-2xl px-4 py-3 text-center text-sm text-white shadow-xl md:bottom-8"
          >
            {aviso.texto}
          </m.p>
        )}
      </AnimatePresence>
    </Panel>
  );
}

function PanelInterno(p: Props & { config: ConfigSupabase }) {
  const cliente = useMemo(() => clienteSupabase(p.config), [p.config]);
  const sesion = useSesion(cliente);

  if (sesion.estado === 'cargando') {
    return (
      <Centro>
        <p className="text-gris" role="status">
          Cargando…
        </p>
      </Centro>
    );
  }
  if (sesion.estado === 'fuera') {
    return (
      <Centro>
        <Ingreso supabase={cliente} negocio={p.negocio} />
      </Centro>
    );
  }
  if (sesion.estado === 'sin-acceso') {
    return (
      <Centro>
        <div className="tarjeta flex max-w-sm flex-col gap-4 p-6" role="alert">
          <h1 className="font-display text-2xl">Esta cuenta no tiene acceso</h1>
          <p className="text-gris text-sm">
            Entraste como {sesion.sesion.user.email}, pero no estás en la lista de administradores.
          </p>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => void cliente.auth.signOut()}
          >
            Usar otra cuenta
          </button>
        </div>
      </Centro>
    );
  }
  return <Tablero cliente={cliente} {...p} />;
}

export default function PanelAdmin(props: Props) {
  if (!props.supabase) {
    return (
      <Centro>
        <p className="tarjeta max-w-md p-6">
          El panel necesita Supabase. Configura PUBLIC_SUPABASE_URL y
          PUBLIC_SUPABASE_PUBLISHABLE_KEY.
        </p>
      </Centro>
    );
  }
  return (
    <Movimiento>
      <PanelInterno {...props} config={props.supabase} />
    </Movimiento>
  );
}
