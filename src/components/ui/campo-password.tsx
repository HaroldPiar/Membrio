/**
 * Campo de contraseña con botón de mostrar/ocultar (ojo al lado derecho).
 *
 * El botón es `type="button"` para no enviar el formulario, anuncia su estado
 * con `aria-pressed` y no altera el `autoComplete` ni el resto de props del
 * input. El valor sigue siendo el mismo: solo cambia `type` entre `password` y
 * `text`.
 */
import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export const CampoPassword = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function CampoPassword({ className, ...props }, referencia) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={referencia}
          {...props}
          type={visible ? 'text' : 'password'}
          className={cn(
            'flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 pr-11 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((anterior) => !anterior)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
