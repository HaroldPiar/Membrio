/**
 * Estado de VERIFICACIÓN de un pago (pendiente/verificado/rechazado, §4.4):
 * SIEMPRE color + ícono + texto, nunca solo color (mismo criterio que
 * EstadoPago del §2.2 — el amarillo sobre fondo claro no alcanza contraste).
 * No confundir con `EstadoPago`: ese es el estado de deuda del AFILIADO.
 */
import { CheckCircle2, Clock, XCircle, type LucideIcon } from 'lucide-react';

import type { z } from '@hono/zod-openapi';

import { estadoPagoSchema } from '../../shared/pagos';
import { ETIQUETAS_ESTADO_VERIFICACION } from '../../lib/pagos-datos';

export type EstadoVerificacion = z.infer<typeof estadoPagoSchema>;

const ESTADOS: Record<EstadoVerificacion, { Icono: LucideIcon; clase: string }> = {
  pendiente: { Icono: Clock, clase: 'bg-por-vencer-bg text-por-vencer-fg' },
  verificado: { Icono: CheckCircle2, clase: 'bg-al-dia-bg text-al-dia-fg' },
  rechazado: { Icono: XCircle, clase: 'bg-en-mora-bg text-en-mora-fg' },
};

export function EstadoVerificacion({ estado }: { estado: EstadoVerificacion }) {
  const { Icono, clase } = ESTADOS[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${clase}`}>
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {ETIQUETAS_ESTADO_VERIFICACION[estado]}
    </span>
  );
}
