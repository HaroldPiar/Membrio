/**
 * Esquema Drizzle — ÚNICA fuente de verdad del modelo de datos de Membrio.
 * Derivado de "Spec técnico de arquitectura.md" §§5–8.
 *
 * Reglas estructurales:
 *  - Multi-tenant: discriminador `organizacion_id`; FKs compuestas `(id, organizacion_id)`
 *    hacia planes, categorias, afiliados y pagos (defensa en datos, spec §5.3).
 *  - Dinero: `numeric(12,2)`; la API lo expone SIEMPRE como string decimal.
 *  - Estado de pago: NO se almacena (se calcula en services/estado-pago.ts).
 *  - Borrado físico prohibido para afiliados con pagos: retiro lógico (spec §6.5).
 *  - Timestamps: `timestamptz` en todas las tablas (spec §6.2).
 *  - Nada específico de Supabase en tablas/migraciones: auth llega en una fase posterior.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Organización, roles y catálogos globales
// ---------------------------------------------------------------------------

export const organizaciones = pgTable('organizaciones', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull(),
  slug: text('slug').notNull().unique(),
  activa: boolean('activa').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Roles globales (matriz de permisos del spec §4). Sin CHECK de valores:
 * es un catálogo ampliable; los roles iniciales se insertan en el seed.
 */
export const roles = pgTable('roles', {
  id: smallint('id').primaryKey().generatedByDefaultAsIdentity(),
  nombre: text('nombre').notNull().unique(),
});

/** Usuarios de la plataforma; siempre pertenecen a una organización. */
export const usuarios = pgTable(
  'usuarios',
  {
    // uuid local con default aleatorio. Cuando se integre Supabase Auth, este id
    // será el de auth.users(id): agregar FK en migración personalizada y quitar el default.
    id: uuid('id').defaultRandom().primaryKey(),
    organizacionId: uuid('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    rolId: smallint('rol_id')
      .notNull()
      .references(() => roles.id),
    correo: text('correo').notNull().unique(),
    nombre: text('nombre').notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    orgIdx: index('usuarios_org_idx').on(t.organizacionId),
  }),
);

/** Catálogo global de EPS (sin organizacion_id: es información de referencia). */
export const eps = pgTable('eps', {
  id: uuid('id').defaultRandom().primaryKey(),
  nombre: text('nombre').notNull().unique(),
  activa: boolean('activa').notNull().default(true),
});

// ---------------------------------------------------------------------------
// Planes y categorías (cursos) — por organización
// ---------------------------------------------------------------------------

export const planes = pgTable(
  'planes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizacionId: uuid('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    nombre: text('nombre').notNull(),
    valorMensualidad: numeric('valor_mensualidad', { precision: 12, scale: 2 }).notNull(),
    valorMatricula: numeric('valor_matricula', { precision: 12, scale: 2 }).notNull(),
    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    orgNombreUnique: uniqueIndex('planes_org_nombre_unique').on(t.organizacionId, t.nombre),
    // Destino de FKs compuestas: (id, organizacion_id) único como CONSTRAINT
    // (se renderiza dentro de CREATE TABLE, antes que cualquier FK que lo referencie).
    orgIdUnique: unique('planes_org_id_unique').on(t.organizacionId, t.id),
    orgIdx: index('planes_org_idx').on(t.organizacionId),
  }),
);

export const categorias = pgTable(
  'categorias',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizacionId: uuid('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    nombre: text('nombre').notNull(),
    activa: boolean('activa').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    orgNombreUnique: uniqueIndex('categorias_org_nombre_unique').on(t.organizacionId, t.nombre),
    orgIdUnique: unique('categorias_org_id_unique').on(t.organizacionId, t.id),
    orgIdx: index('categorias_org_idx').on(t.organizacionId),
  }),
);

// ---------------------------------------------------------------------------
// Afiliados y acudientes
// ---------------------------------------------------------------------------

export const afiliados = pgTable(
  'afiliados',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizacionId: uuid('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    planId: uuid('plan_id').notNull(),
    categoriaId: uuid('categoria_id').notNull(),

    tipoDocumento: text('tipo_documento').notNull(), // CHECK: TI, CC, RC, PAS, PPT
    numeroDocumento: text('numero_documento').notNull(), // CHECK: solo dígitos
    nombre: text('nombre').notNull(),
    celular: text('celular').notNull(),
    correo: text('correo').notNull(),

    epsId: uuid('eps_id').references(() => eps.id), // nullable: sin coincidencia en catálogo
    tipoSangre: text('tipo_sangre').notNull(), // CHECK: A+, A-, B+, B-, AB+, AB-, O+, O-
    fechaNacimiento: date('fecha_nacimiento').notNull(),

    // Dominios que pueden variar por cliente (género, medio de captación):
    // se validan solo en la API (Zod), sin CHECK en base (spec §7).
    genero: text('genero'),
    medioCaptacion: text('medio_captacion'),
    direccion: text('direccion'),

    // Reserva de reglas de descuento (spec §1.3): fracción entre 0 y 1.
    descuento: numeric('descuento', { precision: 5, scale: 4 }).notNull().default('0'),

    fechaIngreso: date('fecha_ingreso').notNull(),
    fechaRetiro: date('fecha_retiro'),
    motivoRetiro: text('motivo_retiro'),
    activo: boolean('activo').notNull().default(true),

    fechaConsentimiento: date('fecha_consentimiento'), // Ley 1581 (spec §11)
    urlDocumentos: text('url_documentos').array(), // rutas de objeto en Storage (spec §10)

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    docUnique: uniqueIndex('afiliados_org_doc_unique').on(
      t.organizacionId,
      t.tipoDocumento,
      t.numeroDocumento,
    ),
    // Destino de FKs compuestas desde acudientes y pago_detalle.
    orgIdUnique: unique('afiliados_org_id_unique').on(t.organizacionId, t.id),
    orgIdx: index('afiliados_org_idx').on(t.organizacionId),
    planFk: foreignKey({
      name: 'afiliados_plan_fk',
      columns: [t.planId, t.organizacionId],
      foreignColumns: [planes.id, planes.organizacionId],
    }),
    categoriaFk: foreignKey({
      name: 'afiliados_categoria_fk',
      columns: [t.categoriaId, t.organizacionId],
      foreignColumns: [categorias.id, categorias.organizacionId],
    }),
    tipoDocumentoCheck: check(
      'afiliados_tipo_documento_check',
      sql`${t.tipoDocumento} in ('TI', 'CC', 'RC', 'PAS', 'PPT')`,
    ),
    numeroDocumentoDigitsCheck: check(
      'afiliados_numero_documento_digits_check',
      sql`${t.numeroDocumento} ~ '^[0-9]+$'`,
    ),
    tipoSangreCheck: check(
      'afiliados_tipo_sangre_check',
      sql`${t.tipoSangre} in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')`,
    ),
    descuentoCheck: check(
      'afiliados_descuento_check',
      sql`${t.descuento} >= 0 and ${t.descuento} <= 1`,
    ),
  }),
);

export const acudientes = pgTable(
  'acudientes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizacionId: uuid('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    afiliadoId: uuid('afiliado_id').notNull(),

    numeroDocumento: text('numero_documento').notNull(), // CHECK: solo dígitos
    nombre: text('nombre').notNull(),
    celular: text('celular'),
    correo: text('correo'),
    // Un solo acudiente principal por afiliado (índice único parcial).
    esPrincipal: boolean('es_principal').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    afiliadoFk: foreignKey({
      name: 'acudientes_afiliado_fk',
      columns: [t.afiliadoId, t.organizacionId],
      foreignColumns: [afiliados.id, afiliados.organizacionId],
    }),
    principalUnico: uniqueIndex('acudientes_un_principal_por_afiliado')
      .on(t.afiliadoId)
      .where(sql`${t.esPrincipal} = true`),
    afiliadoIdx: index('acudientes_afiliado_idx').on(t.afiliadoId),
    numeroDocumentoDigitsCheck: check(
      'acudientes_numero_documento_digits_check',
      sql`${t.numeroDocumento} ~ '^[0-9]+$'`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Pagos (transacción + líneas de detalle)
// ---------------------------------------------------------------------------

export const pagos = pgTable(
  'pagos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizacionId: uuid('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    montoTotal: numeric('monto_total', { precision: 12, scale: 2 }).notNull(),
    estado: text('estado').notNull().default('pendiente'),

    // Snapshot de facturación: se captura al crear el pago y NO cambia
    // después; no se lee de afiliados ni de acudientes (spec §8.1).
    facturaDocumento: text('factura_documento').notNull(),
    facturaNombre: text('factura_nombre').notNull(),
    facturaCelular: text('factura_celular'),
    facturaCorreo: text('factura_correo'),

    observaciones: text('observaciones'),
    urlComprobante: text('url_comprobante'), // ruta de objeto en Storage (spec §10)

    // Auditoría mínima (spec §11): quién verificó/rechazó y cuándo.
    revisadoPor: uuid('revisado_por').references(() => usuarios.id),
    revisadoEn: timestamp('revisado_en', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    // Destino de FK compuesta desde pago_detalle.
    orgIdUnique: unique('pagos_org_id_unique').on(t.organizacionId, t.id),
    orgIdx: index('pagos_org_idx').on(t.organizacionId),
    orgEstadoIdx: index('pagos_org_estado_idx').on(t.organizacionId, t.estado),
    estadoCheck: check(
      'pagos_estado_check',
      sql`${t.estado} in ('pendiente', 'verificado', 'rechazado')`,
    ),
  }),
);

export const pagoDetalle = pgTable(
  'pago_detalle',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizacionId: uuid('organizacion_id')
      .notNull()
      .references(() => organizaciones.id),
    pagoId: uuid('pago_id').notNull(),
    afiliadoId: uuid('afiliado_id').notNull(),

    concepto: text('concepto').notNull(), // CHECK: mensualidad | matricula
    fechaCobertura: date('fecha_cobertura').notNull(), // CHECK: siempre día 1
    monto: numeric('monto', { precision: 12, scale: 2 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pagoFk: foreignKey({
      name: 'pago_detalle_pago_fk',
      columns: [t.pagoId, t.organizacionId],
      foreignColumns: [pagos.id, pagos.organizacionId],
    }),
    afiliadoFk: foreignKey({
      name: 'pago_detalle_afiliado_fk',
      columns: [t.afiliadoId, t.organizacionId],
      foreignColumns: [afiliados.id, afiliados.organizacionId],
    }),
    // Un pago por afiliado, concepto y mes (mensualidad) o año (matrícula).
    unicaPorMes: uniqueIndex('pago_detalle_unica_por_mes').on(
      t.afiliadoId,
      t.concepto,
      t.fechaCobertura,
    ),
    pagoIdx: index('pago_detalle_pago_idx').on(t.pagoId),
    orgFechaIdx: index('pago_detalle_org_fecha_idx').on(t.organizacionId, t.fechaCobertura),
    conceptoCheck: check(
      'pago_detalle_concepto_check',
      sql`${t.concepto} in ('mensualidad', 'matricula')`,
    ),
    diaUnoCheck: check(
      'pago_detalle_dia_uno_check',
      sql`extract(day from ${t.fechaCobertura}) = 1`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Tipos de dominio derivados (para services/repositories)
// ---------------------------------------------------------------------------

export type Organizacion = typeof organizaciones.$inferSelect;
export type Rol = typeof roles.$inferSelect;
export type Usuario = typeof usuarios.$inferSelect;
export type Eps = typeof eps.$inferSelect;
export type Plan = typeof planes.$inferSelect;
export type Categoria = typeof categorias.$inferSelect;
export type Afiliado = typeof afiliados.$inferSelect;
export type Acudiente = typeof acudientes.$inferSelect;
export type Pago = typeof pagos.$inferSelect;
export type PagoDetalle = typeof pagoDetalle.$inferSelect;
