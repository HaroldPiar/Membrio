/**
 * Proveedor Supabase Storage — STUB documentado (spec §10), sin implementar.
 *
 * Para activarlo (fase Supabase) se necesita:
 *  - @supabase/supabase-js y las variables SUPABASE_URL + SERVICE_ROLE_KEY
 *    (solo servidor; nunca al navegador);
 *  - buckets privados `comprobantes` y `documentos-afiliados`;
 *  - urlSubida → supabase.storage.from(bucket).createSignedUploadUrl(ruta);
 *  - urlLectura → createSignedUrl(ruta, 300) (5 min);
 *  - subir/leer NO se usan: el navegador sube directo con la URL firmada.
 *
 * Mientras tanto, `storage/index.ts` entrega AlmacenLocal (desarrollo).
 */
import type { StorageProvider, UrlFirmada } from './tipos';

export class AlmacenSupabaseStub implements StorageProvider {
  private noImplementado(): never {
    throw new Error(
      'AlmacenSupabaseStub no implementado: definir SUPABASE_URL y SERVICE_ROLE_KEY (ver comentario del archivo)',
    );
  }

  urlSubida(): Promise<UrlFirmada> {
    this.noImplementado();
  }

  urlLectura(): Promise<UrlFirmada> {
    this.noImplementado();
  }

  subir(): Promise<void> {
    this.noImplementado();
  }

  leer(): Promise<Uint8Array> {
    this.noImplementado();
  }
}
