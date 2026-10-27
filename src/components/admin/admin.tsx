/**
 * Isla de /admin (Spec del cliente §4.6): pestañas Usuarios, Planes y
 * Categorías DENTRO del guard de `ControlAdmin` (rol admin; la seguridad
 * real es el 403 de la API). Una sola isla para que las tres pestañas
 * compartan el mismo QueryClient — y con él el caché de planes/categorías
 * de Fase 3.
 *
 * Como en /pagos, el estado de pestaña vive solo en memoria (decisión 31):
 * el contrato de fase no pide reflejarlo en la URL.
 */
import { useState } from 'react';

import { cn } from '../../lib/cn';
import { ControlAdmin } from '../ui/control-admin';
import { TabCategorias } from './tab-categorias';
import { TabPlanes } from './tab-planes';
import { TabUsuarios } from './tab-usuarios';

type Pestana = 'usuarios' | 'planes' | 'categorias';

const PESTANAS: { valor: Pestana; etiqueta: string }[] = [
  { valor: 'usuarios', etiqueta: 'Usuarios' },
  { valor: 'planes', etiqueta: 'Planes' },
  { valor: 'categorias', etiqueta: 'Categorías' },
];

export function Administracion() {
  return (
    <ControlAdmin>
      <ContenidoAdmin />
    </ControlAdmin>
  );
}

function ContenidoAdmin() {
  const [pestana, setPestana] = useState<Pestana>('usuarios');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
        <p className="text-sm text-muted-foreground">
          Cuentas de acceso, valores de los planes y categorías (cursos) de tu organización.
        </p>
      </div>

      <div role="tablist" aria-label="Secciones de administración" className="flex gap-1 border-b border-border">
        {PESTANAS.map((item) => {
          const activa = pestana === item.valor;
          return (
            <button
              key={item.valor}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setPestana(item.valor)}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activa
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {item.etiqueta}
            </button>
          );
        })}
      </div>

      {pestana === 'usuarios' && <TabUsuarios />}
      {pestana === 'planes' && <TabPlanes />}
      {pestana === 'categorias' && <TabCategorias />}
    </div>
  );
}
