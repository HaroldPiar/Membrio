/**
 * Selector de tema de tres estados Claro · Oscuro · Sistema, como el de
 * Firefox (Spec del cliente §2.2). Persiste en localStorage (preferencia de
 * interfaz, nunca sesión) y aplica la clase .dark del global.css.
 */
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '../../lib/cn';
import { aplicarTema, temaGuardado, vigilarSistema, type Tema } from '../../lib/tema';

const OPCIONES: readonly { valor: Tema; etiqueta: string; Icono: LucideIcon }[] = [
  { valor: 'claro', etiqueta: 'Claro', Icono: Sun },
  { valor: 'oscuro', etiqueta: 'Oscuro', Icono: Moon },
  { valor: 'sistema', etiqueta: 'Sistema', Icono: Monitor },
];

export function SelectorTema({ compacto }: { compacto: boolean }) {
  const [tema, setTema] = useState<Tema>('sistema');

  useEffect(() => {
    setTema(temaGuardado());
    // Si 'sistema' cambia en el SO, reaplica en caliente.
    return vigilarSistema(() => aplicarTema('sistema'));
  }, []);

  return (
    <div
      role="group"
      aria-label="Tema de la interfaz"
      className={cn('flex gap-0.5 rounded-md bg-muted p-0.5', compacto && 'flex-col')}
    >
      {OPCIONES.map(({ valor, etiqueta, Icono }) => {
        const activo = tema === valor;
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={activo}
            title={etiqueta}
            aria-label={etiqueta}
            onClick={() => {
              aplicarTema(valor);
              setTema(valor);
            }}
            className={cn(
              'flex h-7 flex-1 items-center justify-center gap-1 rounded text-xs font-medium transition-colors',
              activo
                ? 'bg-surface text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!compacto && <span>{etiqueta}</span>}
          </button>
        );
      })}
    </div>
  );
}
