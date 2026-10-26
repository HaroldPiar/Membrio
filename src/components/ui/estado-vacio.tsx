/** Estado vacío de las páginas marcador de la Fase 1. */
import { Inbox } from 'lucide-react';

import { cn } from '../../lib/cn';

export function EstadoVacio({ mensaje, className }: { mensaje: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">{mensaje}</p>
    </div>
  );
}
