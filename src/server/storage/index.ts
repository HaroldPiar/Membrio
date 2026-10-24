/**
 * Selección del proveedor de storage. MVP: disco local (AlmacenLocal).
 * Cambiar acá a AlmacenSupabaseStub (tras implementarlo) cuando entre la
 * fase de Supabase — ninguna ruta ni servicio se entera del proveedor.
 */
import { AlmacenLocal } from './local';
import type { StorageProvider } from './tipos';

export const almacen: StorageProvider = new AlmacenLocal();
