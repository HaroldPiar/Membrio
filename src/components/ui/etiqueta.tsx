/** Etiqueta de formulario (versión simple sin Radix; asociada por htmlFor). */
import type { LabelHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export function Etiqueta({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-sm font-medium leading-none text-foreground', className)}
      {...props}
    />
  );
}
