/** Etiqueta + control + error de campo, para los formularios de afiliados. */
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Etiqueta } from '../ui/etiqueta';

export function Campo({
  id,
  etiqueta,
  error,
  children,
  className,
}: {
  id: string;
  etiqueta: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Etiqueta htmlFor={id}>{etiqueta}</Etiqueta>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-error-fg">
          {error}
        </p>
      )}
    </div>
  );
}
