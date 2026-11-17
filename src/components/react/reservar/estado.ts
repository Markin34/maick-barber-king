/**
 * Estado del reservador como una máquina de pasos (useReducer).
 * Toda la lógica de "qué pasa cuando…" vive aquí, sin React, para poder probarla aparte.
 */
import { MENSAJE_ERROR, type CodigoError } from '../../../lib/reservas-api';

export type Paso = 0 | 1 | 2 | 3 | 4;

export interface Confirmada {
  codigo: string;
  fecha: string;
  hora: string;
}

export interface EstadoReserva {
  paso: Paso;
  /** 1 al avanzar, -1 al retroceder: decide hacia dónde se desliza la animación. */
  direccion: 1 | -1;
  barberoId?: string;
  servicioId?: string;
  fecha?: string;
  hora?: string;
  cliente: string;
  nota: string;
  mostrarErrores: boolean;
  enviando: boolean;
  /** Mensaje para el paso de día y hora (por ejemplo, "alguien ganó esa hora"). */
  aviso?: string;
  errorEnvio?: CodigoError;
  confirmada?: Confirmada;
  /** true = Supabase no respondió y el cliente eligió seguir solo por WhatsApp. */
  respaldo: boolean;
  /** Se incrementa para volver a pedir las horas ocupadas. */
  versionOcupados: number;
}

export type Accion =
  | { tipo: 'preseleccionarBarbero'; barberoId: string }
  | { tipo: 'elegirBarbero'; barberoId: string; serviciosDelBarbero: readonly string[] }
  | { tipo: 'elegirServicio'; servicioId: string }
  | { tipo: 'elegirFecha'; fecha: string }
  | { tipo: 'elegirHora'; hora: string }
  | { tipo: 'irA'; paso: Paso }
  | { tipo: 'escribir'; campo: 'cliente' | 'nota'; valor: string }
  | { tipo: 'intentarEnviar' }
  | { tipo: 'envioIniciado' }
  | { tipo: 'envioExitoso'; confirmada: Confirmada }
  | { tipo: 'envioFallido'; codigo: CodigoError }
  | { tipo: 'reintentarHorarios' }
  | { tipo: 'usarRespaldo' }
  | { tipo: 'reiniciar' };

export const ESTADO_INICIAL: EstadoReserva = {
  paso: 0,
  direccion: 1,
  cliente: '',
  nota: '',
  mostrarErrores: false,
  enviando: false,
  respaldo: false,
  versionOcupados: 0,
};

const avanzarA = (e: EstadoReserva, paso: Paso): EstadoReserva => ({
  ...e,
  paso,
  direccion: paso >= e.paso ? 1 : -1,
});

export function reducirReserva(e: EstadoReserva, a: Accion): EstadoReserva {
  switch (a.tipo) {
    case 'preseleccionarBarbero':
      return { ...e, barberoId: a.barberoId, paso: 1, direccion: 1 };

    case 'elegirBarbero': {
      const servicioSigue = e.servicioId && a.serviciosDelBarbero.includes(e.servicioId);
      return avanzarA(
        {
          ...e,
          barberoId: a.barberoId,
          servicioId: servicioSigue ? e.servicioId : undefined,
          hora: undefined,
          aviso: undefined,
        },
        1,
      );
    }

    case 'elegirServicio':
      return avanzarA({ ...e, servicioId: a.servicioId, hora: undefined, aviso: undefined }, 2);

    case 'elegirFecha':
      return { ...e, fecha: a.fecha, hora: undefined };

    case 'elegirHora':
      return { ...e, hora: a.hora };

    case 'irA':
      return avanzarA(
        { ...e, aviso: a.paso === 3 ? undefined : e.aviso, errorEnvio: undefined },
        a.paso,
      );

    case 'escribir':
      return { ...e, [a.campo]: a.valor };

    case 'intentarEnviar':
      return { ...e, mostrarErrores: true };

    case 'envioIniciado':
      return { ...e, enviando: true, errorEnvio: undefined };

    case 'envioExitoso':
      return avanzarA({ ...e, enviando: false, confirmada: a.confirmada }, 4);

    case 'envioFallido':
      // Si la hora ya no sirve, volvemos a elegir con los horarios actualizados.
      if (
        a.codigo === 'HORA_OCUPADA' ||
        a.codigo === 'HORA_PASADA' ||
        a.codigo === 'FUERA_DE_HORARIO'
      ) {
        return avanzarA(
          {
            ...e,
            enviando: false,
            hora: undefined,
            aviso: MENSAJE_ERROR[a.codigo],
            versionOcupados: e.versionOcupados + 1,
          },
          2,
        );
      }
      return { ...e, enviando: false, errorEnvio: a.codigo };

    case 'reintentarHorarios':
      return { ...e, versionOcupados: e.versionOcupados + 1 };

    case 'usarRespaldo':
      return { ...e, respaldo: true };

    case 'reiniciar':
      // Conserva el nombre: si reserva otra vez, no tiene que escribirlo de nuevo.
      return { ...ESTADO_INICIAL, cliente: e.cliente, respaldo: e.respaldo, direccion: -1 };
  }
}
