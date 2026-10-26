/**
 * Aviso de error de una consulta del dashboard + reintento.
 * En 401 `procesar` ya redirigió a /login antes de llegar acá (Spec §5).
 */
import { RotateCcw, TriangleAlert } from 'lucide-react';

import { Boton } from '../ui/boton';

export function ErrorConsulta({
  error,
  reintento,
}: {
  error: Error | null;
  reintento: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-en-mora-fg/40 bg-en-mora-bg px-4 py-6 text-center"
    >
      <TriangleAlert className="h-5 w-5 text-en-mora-fg" aria-hidden="true" />
      <p className="text-sm text-en-mora-fg">
        {error?.message ?? 'No se pudo cargar la información.'}
      </p>
      <Boton variante="borde" tamano="chico" onClick={reintento}>
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Reintentar
      </Boton>
    </div>
  );
}
