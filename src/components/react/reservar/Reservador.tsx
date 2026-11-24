/**
 * Reserva paso a paso: barbero → servicio → día y hora → datos → confirmación.
 *
 * - El estado vive en un reducer (estado.ts), probado aparte.
 * - Con Supabase: tacha horas ocupadas y guarda la reserva antes de avisar por WhatsApp.
 * - Sin Supabase, o si no responde: funciona solo con WhatsApp.
 *
 * Se monta con client:only porque depende de la hora y de la URL del cliente:
 * renderizarlo en el build mostraría horas del día en que se construyó la página.
 */
import { AnimatePresence, m } from 'motion/react';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Negocio, Servicio } from '../../../data/schema';
import { diasDisponibles, horasDelDia, proximaHoraLibre } from '../../../lib/horarios';
import { duracion, fechaCorta, fechaLarga, formatoBs, hora12 } from '../../../lib/formato';
import { sumarDias } from '../../../lib/tiempo';
import {
  crearReserva,
  ErrorReserva,
  registrarError,
  type ConfigSupabase,
} from '../../../lib/reservas-api';
import { primerNombre } from '../../../lib/texto';
import { linkWhatsApp, mensajeReserva } from '../../../lib/whatsapp';
import { Movimiento } from '../comun/Movimiento';
import { deslizarPaso } from '../comun/animaciones';
import { ESTADO_INICIAL, reducirReserva, type EstadoReserva, type Paso } from './estado';
import { useAhora, useOcupados, useOcupadosDeTodos } from './hooks';
import { PasoBarbero } from './PasoBarbero';
import { PasoConfirmado } from './PasoConfirmado';
import { PasoDatos } from './PasoDatos';
import { PasoHorario } from './PasoHorario';
import { PasoServicio } from './PasoServicio';
import { Progreso } from './Progreso';
import type { BarberoVista } from './tipos';

interface Props {
  negocio: Negocio;
  barberos: BarberoVista[];
  servicios: Servicio[];
  /** Si falta, la página funciona solo con WhatsApp. */
  supabase?: ConfigSupabase;
}

const SIN_OCUPADOS = new Map<string, readonly (readonly [number, number])[]>();

/** Si el cliente viene de "Reservar con Micki", empieza con Micki elegido. */
function estadoDesdeUrl(barberos: BarberoVista[]): EstadoReserva {
  const id = new URLSearchParams(window.location.search).get('barbero');
  return id && barberos.some((b) => b.id === id)
    ? reducirReserva(ESTADO_INICIAL, { tipo: 'preseleccionarBarbero', barberoId: id })
    : ESTADO_INICIAL;
}

function ReservadorInterno({ negocio, barberos, servicios, supabase }: Props) {
  const ahora = useAhora(negocio.zonaHoraria);
  const [e, despachar] = useReducer(reducirReserva, barberos, estadoDesdeUrl);
  const enLinea = Boolean(supabase) && !e.respaldo;

  const barbero = barberos.find((b) => b.id === e.barberoId);
  const servicio = servicios.find((s) => s.id === e.servicioId);
  const serviciosDelBarbero = useMemo(
    () => (barbero ? servicios.filter((s) => barbero.serviciosIds.includes(s.id)) : []),
    [barbero, servicios],
  );

  const carga = useOcupados({
    config: enLinea ? supabase : undefined,
    barberoId: e.paso === 2 ? e.barberoId : undefined,
    zonaHoraria: negocio.zonaHoraria,
    dias: negocio.diasAnticipacion,
    version: e.versionOcupados,
  });
  const ocupados = enLinea && carga.estado === 'listo' ? carga.ocupados : SIN_OCUPADOS;

  // En la lista de barberos: la próxima hora libre de cada uno, con su agenda propia.
  const idsBarberos = useMemo(() => barberos.map((b) => b.id), [barberos]);
  const deTodos = useOcupadosDeTodos({
    config: enLinea ? supabase : undefined,
    barberoIds: idsBarberos,
    zonaHoraria: negocio.zonaHoraria,
    dias: negocio.diasAnticipacion,
    activo: e.paso === 0,
  });
  const disponibilidad = useMemo(() => {
    if (!deTodos) return undefined;
    const manana = sumarDias(ahora.fecha, 1);
    return new Map(
      barberos.map((b) => {
        // Se calcula con su primer servicio (el corte normal), que es lo que más se reserva.
        const servicioBase = servicios.find((s) => b.serviciosIds.includes(s.id));
        const libre = servicioBase
          ? proximaHoraLibre({
              negocio,
              barbero: b,
              servicio: servicioBase,
              ahora,
              ocupados: deTodos.get(b.id),
            })
          : null;
        const cuando = !libre
          ? null
          : libre.fecha === ahora.fecha
            ? 'hoy'
            : libre.fecha === manana
              ? 'mañana'
              : `${fechaCorta(libre.fecha).dia} ${fechaCorta(libre.fecha).numero}`;
        return [
          b.id,
          {
            texto: libre
              ? `Próxima hora libre: ${cuando} ${hora12(libre.hora)}`
              : 'Sin horas libres por ahora',
            libreHoy: libre?.fecha === ahora.fecha,
          },
        ] as const;
      }),
    );
  }, [deTodos, barberos, servicios, negocio, ahora]);

  const dias = useMemo(
    () =>
      barbero && servicio ? diasDisponibles({ negocio, barbero, servicio, ahora, ocupados }) : [],
    [negocio, barbero, servicio, ahora, ocupados],
  );
  const fechaActiva = e.fecha && dias.includes(e.fecha) ? e.fecha : dias[0];
  const horas = useMemo(
    () =>
      barbero && servicio && fechaActiva
        ? horasDelDia({ negocio, barbero, servicio, fecha: fechaActiva, ahora, ocupados })
        : [],
    [negocio, barbero, servicio, fechaActiva, ahora, ocupados],
  );
  // Una hora elegida puede dejar de servir (pasó el tiempo o alguien la tomó).
  const horaValida = e.hora && horas.some((h) => h.hora === e.hora && h.libre) ? e.hora : undefined;
  const nombreValido = e.cliente.trim().length >= 2;

  const mensaje = useCallback(
    (fecha: string, hora: string, codigo?: string) =>
      barbero && servicio
        ? mensajeReserva({
            negocio: negocio.nombre,
            barbero: barbero.apodo,
            servicio: servicio.nombre,
            precio: servicio.precio,
            duracionMin: servicio.duracionMin,
            fecha,
            hora,
            cliente: e.cliente,
            nota: e.nota,
            formaDePago: negocio.formaDePago,
            codigo,
            enlaceCancelar: codigo
              ? `${window.location.origin}/cancelar?codigo=${encodeURIComponent(codigo)}`
              : undefined,
          })
        : '',
    [barbero, servicio, negocio, e.cliente, e.nota],
  );
  const enlaceSinGuardar =
    barbero && fechaActiva && horaValida && nombreValido
      ? linkWhatsApp(barbero.whatsapp, mensaje(fechaActiva, horaValida))
      : undefined;

  const confirmar = async () => {
    despachar({ tipo: 'intentarEnviar' });
    if (!supabase || !barbero || !servicio || !fechaActiva || !horaValida || !nombreValido) return;
    if (e.enviando) return;
    despachar({ tipo: 'envioIniciado' });
    try {
      const { codigo } = await crearReserva(supabase, {
        barbero: barbero.id,
        servicio: servicio.nombre,
        fecha: fechaActiva,
        hora: horaValida,
        duracionMin: servicio.duracionMin,
        cliente: e.cliente,
        nota: e.nota,
      });
      despachar({
        tipo: 'envioExitoso',
        confirmada: { codigo, fecha: fechaActiva, hora: horaValida },
      });
    } catch (error) {
      const codigo = error instanceof ErrorReserva ? error.codigo : 'DESCONOCIDO';
      despachar({ tipo: 'envioFallido', codigo });
      // Lo que no es culpa del cliente (ni de su internet) se anota para revisarlo.
      if (codigo === 'DESCONOCIDO' || codigo === 'SIN_CATALOGO') {
        void registrarError(supabase, {
          mensaje: `Reserva fallida: ${codigo}`,
          pagina: '/reservar',
          detalle: error instanceof Error ? (error.stack ?? error.message) : String(error),
        });
      }
    }
  };

  // Al cambiar de paso (no al cargar), lleva el foco al título: teclado y lectores de pantalla.
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const pasoAnterior = useRef(e.paso);
  useEffect(() => {
    if (pasoAnterior.current === e.paso) return;
    pasoAnterior.current = e.paso;
    tituloRef.current?.focus({ preventScroll: true });
    if (tituloRef.current && tituloRef.current.getBoundingClientRect().top < 80) {
      tituloRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [e.paso]);

  const titulos: Record<Paso, string> = {
    0: '¿Con quién te cortas?',
    1: barbero ? `¿Qué te hace ${barbero.apodo}?` : '¿Qué servicio quieres?',
    2: '¿Qué día y a qué hora?',
    3: 'Tus datos',
    4: '¡Reserva confirmada!',
  };

  const resumen: [string, string][] =
    barbero && servicio && fechaActiva && horaValida
      ? [
          ['Barbero', `${barbero.apodo} (${barbero.nombre})`],
          ['Servicio', `${servicio.nombre} · ${duracion(servicio.duracionMin)}`],
          ['Día', fechaLarga(fechaActiva)],
          ['Hora', hora12(horaValida)],
          ['Precio', formatoBs(servicio.precio)],
        ]
      : [];

  return (
    <div className="flex flex-col gap-6">
      <Progreso paso={e.paso} />

      <div className="flex items-center justify-between gap-4">
        <h1
          ref={tituloRef}
          tabIndex={-1}
          className="font-display scroll-mt-24 text-3xl leading-tight outline-none sm:text-4xl"
        >
          {titulos[e.paso]}
        </h1>
        {e.paso > 0 && e.paso < 4 && (
          <button
            type="button"
            className="text-gris hover:text-texto shrink-0 rounded-lg px-2 py-2 text-sm font-semibold"
            onClick={() => despachar({ tipo: 'irA', paso: (e.paso - 1) as Paso })}
          >
            ← Atrás
          </button>
        )}
      </div>

      {e.paso > 0 && e.paso < 4 && barbero && (
        <p className="text-gris -mt-3 text-sm">
          {barbero.apodo}
          {servicio && e.paso > 1 && ` · ${servicio.nombre} · ${formatoBs(servicio.precio)}`}
          {e.paso > 2 &&
            fechaActiva &&
            horaValida &&
            ` · ${fechaLarga(fechaActiva)}, ${hora12(horaValida)}`}
        </p>
      )}

      <AnimatePresence mode="wait" custom={e.direccion} initial={false}>
        <m.div
          key={e.paso}
          custom={e.direccion}
          variants={deslizarPaso}
          initial="entra"
          animate="quieto"
          exit="sale"
        >
          {e.paso === 0 && (
            <PasoBarbero
              barberos={barberos}
              seleccionado={e.barberoId}
              disponibilidad={disponibilidad}
              onElegir={(b) =>
                despachar({
                  tipo: 'elegirBarbero',
                  barberoId: b.id,
                  serviciosDelBarbero: b.serviciosIds,
                })
              }
            />
          )}

          {e.paso === 1 && (
            <PasoServicio
              servicios={serviciosDelBarbero}
              seleccionado={e.servicioId}
              onElegir={(id) => despachar({ tipo: 'elegirServicio', servicioId: id })}
            />
          )}

          {e.paso === 2 && barbero && (
            <PasoHorario
              apodo={barbero.apodo}
              hoy={ahora.fecha}
              dias={dias}
              fechaActiva={fechaActiva}
              horas={horas}
              horaElegida={horaValida}
              carga={carga}
              enLinea={enLinea}
              aviso={e.aviso}
              diasAnticipacion={negocio.diasAnticipacion}
              onFecha={(fecha) => despachar({ tipo: 'elegirFecha', fecha })}
              onHora={(hora) => despachar({ tipo: 'elegirHora', hora })}
              onContinuar={() => horaValida && despachar({ tipo: 'irA', paso: 3 })}
              onReintentar={() => despachar({ tipo: 'reintentarHorarios' })}
              onRespaldo={() => despachar({ tipo: 'usarRespaldo' })}
            />
          )}

          {e.paso === 3 && barbero && resumen.length > 0 && (
            <PasoDatos
              resumen={resumen}
              apodo={barbero.apodo}
              cliente={e.cliente}
              nota={e.nota}
              nombreValido={nombreValido}
              mostrarErrores={e.mostrarErrores}
              enLinea={enLinea}
              enviando={e.enviando}
              errorEnvio={e.errorEnvio}
              enlaceSinGuardar={enlaceSinGuardar}
              formaDePago={negocio.formaDePago}
              onEscribir={(campo, valor) => despachar({ tipo: 'escribir', campo, valor })}
              onConfirmar={() => void confirmar()}
              onIntentar={() => despachar({ tipo: 'intentarEnviar' })}
            />
          )}

          {e.paso === 4 && barbero && servicio && e.confirmada && (
            <PasoConfirmado
              nombre={primerNombre(e.cliente)}
              apodo={barbero.apodo}
              codigo={e.confirmada.codigo}
              resumen={[
                ['Código', e.confirmada.codigo],
                ['Barbero', barbero.apodo],
                ['Servicio', `${servicio.nombre} · ${formatoBs(servicio.precio)}`],
                ['Día', fechaLarga(e.confirmada.fecha)],
                ['Hora', hora12(e.confirmada.hora)],
              ]}
              enlaceWhatsApp={linkWhatsApp(
                barbero.whatsapp,
                mensaje(e.confirmada.fecha, e.confirmada.hora, e.confirmada.codigo),
              )}
              formaDePago={negocio.formaDePago}
              onOtra={() => despachar({ tipo: 'reiniciar' })}
            />
          )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

export default function Reservador(props: Props) {
  return (
    <Movimiento>
      <ReservadorInterno {...props} />
    </Movimiento>
  );
}
