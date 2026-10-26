/**
 * Entradas del menú lateral (Spec del cliente §3) y su filtrado por rol.
 * Datos PUROS sin React ni librerías de íconos: los íconos se traducen en
 * barra-lateral.tsx, y el filtrado se testea en tests/unit/menu.test.ts.
 */
export type IconoMenu = 'panel' | 'olas' | 'tarjeta' | 'ajustes';

export type EntradaMenu = {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: IconoMenu;
  readonly soloAdmin: boolean;
};

export const entradasMenu: readonly EntradaMenu[] = [
  { ruta: '/', etiqueta: 'Dashboard', icono: 'panel', soloAdmin: false },
  { ruta: '/afiliados', etiqueta: 'Afiliados', icono: 'olas', soloAdmin: false },
  { ruta: '/pagos', etiqueta: 'Pagos', icono: 'tarjeta', soloAdmin: false },
  { ruta: '/admin', etiqueta: 'Administración', icono: 'ajustes', soloAdmin: true },
];

/**
 * El menú se oculta por rol, pero no es la seguridad: la API responde 403
 * (Spec del cliente §3.1). Rol desconocido/no-admin nunca ve Administración.
 */
export function entradasParaRol(rol: string | undefined): readonly EntradaMenu[] {
  return entradasMenu.filter((entrada) => !entrada.soloAdmin || rol === 'admin');
}

/** ¿La entrada corresponde a la ruta actual? (raíz exacta; el resto por prefijo). */
export function esEntradaActiva(entrada: EntradaMenu, rutaActual: string): boolean {
  if (entrada.ruta === '/') return rutaActual === '/';
  return rutaActual === entrada.ruta || rutaActual.startsWith(`${entrada.ruta}/`);
}
