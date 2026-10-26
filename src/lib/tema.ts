/**
 * Preferencia de tema de tres estados: Claro · Oscuro · Sistema
 * (Spec del cliente §2.2). localStorage SOLO guarda preferencias de interfaz;
 * los tokens de sesión jamás se tocan aquí (spec técnico §4).
 *
 * El "sin parpadeo" al cargar vive en un script ISINLINE del <head> de los
 * layouts (is:inline no puede importar este módulo): duplica estas ~6 líneas
 * a propósito. Si cambia esta lógica, cambia allá también.
 */
export type Tema = 'claro' | 'oscuro' | 'sistema';

export const CLAVE_TEMA = 'membrio_tema';

export function temaGuardado(): Tema {
  const crudo = window.localStorage.getItem(CLAVE_TEMA);
  return crudo === 'claro' || crudo === 'oscuro' ? crudo : 'sistema';
}

function sistemaPideOscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** ¿Debe pintarse el modo oscuro con esta preferencia? */
export function oscuroActivo(tema: Tema): boolean {
  if (tema === 'oscuro') return true;
  if (tema === 'claro') return false;
  return sistemaPideOscuro();
}

/** Persiste la preferencia y la aplica al documento. */
export function aplicarTema(tema: Tema): void {
  window.localStorage.setItem(CLAVE_TEMA, tema);
  const oscuro = oscuroActivo(tema);
  document.documentElement.classList.toggle('dark', oscuro);
  document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light';
}

/** Reaplica cuando 'sistema' cambia en el SO, solo si la preferencia sigue en 'sistema'. */
export function vigilarSistema(alCambiar: () => void): () => void {
  const consulta = window.matchMedia('(prefers-color-scheme: dark)');
  const oyente = (): void => {
    if (temaGuardado() === 'sistema') alCambiar();
  };
  consulta.addEventListener('change', oyente);
  return () => consulta.removeEventListener('change', oyente);
}
