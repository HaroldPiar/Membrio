/**
 * Interfaz de almacenamiento de archivos (spec §10).
 *
 * El API nunca recibe binarios: devuelve URLs firmadas de corta duración.
 * La ruta del objeto SIEMPRE lleva el tenant por prefijo
 * `{organizacion_id}/{tipo}/{uuid}.{ext}` y la base guarda esa ruta.
 *
 * El navegador sube/baja DIRECTO contra el proveedor (no a través de la API);
 * la API solo firma tras validar rol, tipo y tamaño.
 */
export type UrlFirmada = {
  /** Ruta relativa (local) o absoluta (Supabase) para el cliente. */
  url: string;
  expiraEn: Date;
};

export interface StorageProvider {
  /** URL firmada de SUBIDA (el cliente hace PUT con el archivo). */
  urlSubida(datos: { ruta: string; contentType: string }): Promise<UrlFirmada>;
  /** URL firmada de LECTURA (corta duración, tras validar el tenant). */
  urlLectura(ruta: string): Promise<UrlFirmada>;
  /**
   * Recepción/entrega de bytes — solo existe en el proveedor local de
   * desarrollo. Con Supabase Storage estos métodos no se usan: el navegador
   * habla directo con Storage usando las URLs firmadas.
   */
  subir(ruta: string, bytes: Uint8Array): Promise<void>;
  leer(ruta: string): Promise<Uint8Array>;
}
