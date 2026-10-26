/**
 * Estado de pago (Spec del cliente §2.2): SIEMPRE color + ícono + texto, nunca
 * solo color (daltonismo y contraste del amarillo sobre fondo claro).
 * Aún no se usa en pantallas: existe desde la Fase 1 para fijar la pieza.
 */
import { CheckCircle2, Clock, TriangleAlert, type LucideIcon } from 'lucide-react';

import { estadoPagoSchema } from '../../shared/afiliados';
import type { z } from '@hono/zod-openapi';

export type EstadoPago = z.infer<typeof estadoPagoSchema>;

const ESTADOS: Record<
  EstadoPago,
  { texto: string; Icono: LucideIcon; clase: string }
> = {
  al_dia: {
    texto: 'Al día',
    Icono: CheckCircle2,
    clase: 'bg-al-dia-bg text-al-dia-fg',
  },
  por_vencer: {
    texto: 'Por vencer',
    Icono: Clock,
    clase: 'bg-por-vencer-bg text-por-vencer-fg',
  },
  en_mora: {
    texto: 'En mora',
    Icono: TriangleAlert,
    clase: 'bg-en-mora-bg text-en-mora-fg',
  },
};

export function EstadoPago({ estado }: { estado: EstadoPago | null }) {
  if (!estado) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        —
      </span>
    );
  }
  const { texto, Icono, clase } = ESTADOS[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${clase}`}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      {texto}
    </span>
  );
}
