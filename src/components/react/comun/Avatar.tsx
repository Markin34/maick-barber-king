import { iniciales } from '../../../lib/texto';

interface Props {
  nombre: string;
  fotoUrl?: string;
  tamano?: number;
  className?: string;
}

/** Foto del barbero o, si no hay, sus iniciales sobre un fondo en tono latón. */
export function Avatar({ nombre, fotoUrl, tamano = 64, className = '' }: Props) {
  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt=""
        width={tamano}
        height={tamano}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`font-display grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#a06a32] to-[#3d2a17] text-white ${className}`}
      style={{ width: tamano, height: tamano, fontSize: Math.round(tamano / 2.6) }}
    >
      {iniciales(nombre)}
    </span>
  );
}
