# Membrio — Especificación técnica de arquitectura

Versión 0.1 · 17 de octubre de 2026 · Estado: borrador para el MVP (primer cliente: Truchas)

## 1. Propósito y alcance

Membrio es una plataforma SaaS multi-tenant para centralizar la gestión de afiliados y automatizar el seguimiento de cobros recurrentes en organizaciones como clubes y academias. Este documento fija las decisiones técnicas de arquitectura del MVP. El modelo de datos está en `membrio_schema.sql`; aquí se describe todo lo que lo rodea.

### Dentro del alcance del MVP

- Autenticación y roles por organización.
- Gestión de afiliados, acudientes, planes, categorías (cursos) y catálogo de EPS.
- Registro de pagos con detalle (varios meses y/o varios afiliados por pago), con comprobante adjunto.
- Estado de pago calculado (Al día, Por vencer, En mora).
- Dashboard de recaudo y cartera pendiente.
- Migración de los datos actuales de Truchas desde Google Sheets.

### Fuera del alcance del MVP

- Programación de clases y registro de asistencia.
- Póliza de seguro (pendiente de definir con el cliente).
- Conciliación automática de comprobantes (OCR) y facturación electrónica automática.
- Reglas de descuento complejas (solo se reserva la columna `descuento`).
- Pasarela de pagos en línea.

## 2. Stack tecnológico

| Capa | Decisión | Motivo |
| --- | --- | --- |
| Frontend | Astro + React (islas) | Ya definido; Astro entrega páginas ligeras y React maneja las partes interactivas |
| Hosting | Vercel | Ya definido; despliegue por rama y previews |
| API | TypeScript, endpoints de Astro con Hono como router | Un solo lenguaje y un solo despliegue; Hono es portable si la API se separa luego |
| Base de datos | PostgreSQL en Supabase | Ya definido |
| Acceso a datos | Drizzle ORM sobre el driver `postgres` | Esquema pensado en SQL, claves compuestas sin fricción, liviano en serverless |
| Validación | Zod | Esquemas compartidos entre API y formularios React |
| Autenticación | Supabase Auth | Evita reimplementar sesiones, recuperación de clave y verificación de correo |
| Archivos | Supabase Storage (buckets privados) | Almacenamiento de objetos ya incluido en el proyecto |
| Pruebas | Vitest (unitarias e integración), Playwright (flujos críticos) | Estándar del ecosistema |
| Gestor de paquetes | pnpm | Rápido y reproducible |

## 3. Arquitectura general

```
Navegador (Astro + React)
   │  login con Supabase Auth → cookie httpOnly con la sesión
   ▼
API en Vercel (Astro endpoints + Hono)
   │  middleware: valida sesión → carga usuario, rol y organizacion_id
   │  rutas → Zod → servicios → repositorios
   ├──► PostgreSQL (Supabase, vía pooler en modo transaction) con Drizzle
   └──► Supabase Storage (URLs firmadas de subida y lectura)
```

### Capas del backend

1. **Rutas (Hono):** reciben la petición, validan entrada con Zod y llaman a un servicio. No contienen lógica de negocio ni SQL.
2. **Servicios:** reglas de negocio y transacciones (por ejemplo, crear un pago con su detalle).
3. **Repositorios:** único lugar donde se escribe SQL o consultas Drizzle. Todos reciben un contexto de tenant y aplican `organizacion_id` siempre.
4. **Contexto de petición:** objeto inmutable `{ usuarioId, organizacionId, rol }` creado por el middleware de autenticación.

### Estructura del repositorio

```
/src
  /pages          páginas Astro (UI)
  /pages/api      punto de entrada de la API (ruta comodín hacia Hono)
  /components     componentes React
  /server
    /routes       rutas Hono por módulo
    /services     lógica de negocio
    /repositories acceso a datos
    /middleware   auth, tenant, errores
    /db           esquema Drizzle y cliente
  /shared         esquemas Zod y tipos usados por front y back
/drizzle          migraciones
/tests
```

## 4. Autenticación y autorización

- **Sin registro público.** Los usuarios los crea un administrador de la organización mediante la API de administración de Supabase Auth, ejecutada solo en el servidor con la clave de servicio.
- **Sesión:** cookie httpOnly gestionada con `@supabase/ssr`. El token no se guarda en `localStorage`.
- **Verificación:** el middleware valida el JWT en cada petición y luego busca al usuario en la tabla `usuarios` para obtener `organizacion_id`, `rol` y `activo`. Un usuario con `activo = false` es rechazado aunque su sesión sea válida.
- **Claves:** la clave de servicio de Supabase y la cadena de conexión a la base nunca llegan al navegador. Solo variables de entorno del servidor.

### Roles iniciales

| Acción | admin | operador |
| --- | --- | --- |
| Gestionar usuarios | Sí | No |
| Gestionar planes, categorías y configuración | Sí | No |
| Crear y editar afiliados y acudientes | Sí | Sí |
| Registrar pagos y adjuntar comprobantes | Sí | Sí |
| Verificar o rechazar pagos | Sí | Sí |
| Ver dashboard | Sí | Sí |
| Borrar afiliados | Sí | No |

La matriz se aplica con un middleware `requireRole(...)` por ruta. Es una decisión inicial, ajustable cuando se conozcan los perfiles reales de Truchas.

## 5. Multi-tenancy

**Modelo:** base de datos compartida, esquema compartido, discriminador `organizacion_id`.

### Reglas obligatorias

1. El `organizacion_id` **solo** proviene de la sesión autenticada. Nunca del cuerpo, la URL ni parámetros de consulta.
2. Ningún endpoint accede a la base directamente: todo pasa por repositorios que exigen el contexto de tenant.
3. Las claves foráneas compuestas `(id, organizacion_id)` impiden referencias cruzadas entre organizaciones a nivel de datos.
4. Todo recurso identificado por `:id` en la URL se busca siempre con `id` **y** `organizacion_id`. Si no aparece, se responde 404 (no 403), para no revelar que existe en otra organización.

### Exposición de Supabase

Supabase publica el esquema `public` mediante su API de datos (PostgREST) con la clave anónima. Como el acceso a datos de Membrio es solo vía API propia, se aplica lo siguiente:

- **Activar RLS en todas las tablas** del esquema `public` y no crear políticas permisivas. Así, cualquier acceso con la clave anónima queda denegado.
- La API propia se conecta con un rol de servidor que no está sujeto a esas políticas.
- Evaluar más adelante políticas RLS por `organizacion_id` como segunda barrera.

## 6. Capa de datos

- **Conexión:** pooler de Supabase en modo transaction para funciones serverless. Cliente creado una vez por instancia, con `max` de conexiones bajo (1 a 3 por instancia).
- **Esquema en código:** definido en Drizzle, coherente con `membrio_schema.sql`.
- **Migraciones:** una sola herramienta, **drizzle-kit**. Los elementos que Drizzle no genera (CHECK complejos, índices parciales, vistas, activación de RLS, referencia a `auth.users`) se escriben como migraciones SQL personalizadas, también versionadas.
- **Transacciones:** toda operación que escriba en más de una tabla se ejecuta en una transacción (crear pago con detalle, retirar afiliado).
- **Dinero:** columnas `numeric(12,2)`. En la API los montos viajan como **cadenas decimales**, nunca como `number` flotante. Los cálculos se hacen en la base o con una librería decimal.
- **Fechas:** se almacenan en UTC. La zona de negocio es `America/Bogota`. `fecha_cobertura` y `fecha_nacimiento` son `date` sin zona.
- **Entornos de base:** un proyecto Supabase para producción y otro para desarrollo/staging. Nunca se prueba contra producción.

### Ajustes al esquema derivados de esta arquitectura

1. **`usuarios`:** `id` pasa a `uuid` y referencia `auth.users(id)`. Se elimina `password_hash`. El correo vive en `auth.users`.
2. **Timestamps:** `timestamp` pasa a `timestamptz` en todas las tablas.
3. **RLS:** activar RLS en todas las tablas del esquema `public`.
4. **Vista `v_estado_pago`:** nueva, descrita en la sección 8.
5. **`ON DELETE`:** borrar un afiliado con pagos asociados debe fallar. Preferir retiro lógico (`activo = false`) y reservar el borrado físico a correcciones de captura.

## 7. Validación

- Los esquemas Zod viven en `/shared` y los usan la API (validación obligatoria) y los formularios React (mensajes inmediatos).
- Dominios cerrados (tipo de documento, tipo de sangre, concepto, estado de pago) se validan en Zod **y** con CHECK en la base. Dominios que pueden variar por cliente (género, medio de captación) se validan solo en la API.
- Número de documento: solo dígitos, a diferencia de los formularios actuales de Google Forms, que permiten texto.
- Fecha de cobertura: siempre día 1 del mes.
- Un pago es válido solo si `monto_total` es igual a la suma de los montos de sus líneas.

## 8. Lógica de negocio

### 8.1 Registro de pagos

Un pago es una transacción (`pagos`) que se aplica a una o más líneas (`pago_detalle`).

1. El operador crea el pago con sus líneas (afiliado, concepto, mes, monto) y los datos de facturación.
2. La API valida pertenencia al tenant de cada afiliado, la suma de montos y que no existan líneas duplicadas (`afiliado_id`, `concepto`, `fecha_cobertura`).
3. Se inserta todo en una transacción. El pago nace en estado `pendiente`.
4. Un usuario revisa el comprobante y lo pasa a `verificado` o `rechazado`.
5. Si se rechaza, se liberan sus líneas de detalle para permitir un nuevo intento del mismo mes.

Los datos de facturación (documento, nombre, celular, correo) son un **snapshot** y no se leen de afiliados ni de acudientes. La UI puede sugerirlos como valores iniciales, pero lo guardado en el pago no cambia después.

### 8.2 Matrícula

La matrícula es una línea con `concepto = 'matricula'`, una por afiliado y año. Convención del MVP: su `fecha_cobertura` es el 1 de enero del año correspondiente. El valor sugerido sale de `planes.valor_matricula`.

### 8.3 Estado de pago (Al día, Por vencer, En mora)

El estado **no se almacena**. Se calcula en la vista `v_estado_pago` a partir de `pago_detalle` con pagos en estado `verificado`, la fecha actual en zona `America/Bogota`, `fecha_ingreso` y `fecha_retiro`.

Reglas propuestas para el MVP (supuestos a validar con Truchas):

- Solo se evalúan afiliados activos.
- Solo cuentan los meses desde `fecha_ingreso` hasta el mes actual.
- Los meses facturables se definen por organización. En Truchas son de **febrero a diciembre** (enero no se cobra, según el formulario actual). En el MVP se define como constante de configuración.
- **En mora:** existe al menos un mes facturable anterior al actual sin pago verificado.
- **Por vencer:** todos los meses anteriores están pagados, el mes actual no, y faltan N días o menos para el límite de pago. N y el día límite se parametrizan; valores iniciales supuestos: día límite 5 y N = 5.
- **Al día:** el mes actual y todos los anteriores están cubiertos.

La regla de pagos de varios meses por adelantado queda cubierta automáticamente, porque se evalúa por mes y no por pago.

### 8.4 Dashboard

Consultas agregadas sobre `pago_detalle` y `v_estado_pago`:

- Recaudo por mes (suma de montos verificados).
- Cartera pendiente (afiliados en mora y meses adeudados, valorados con `planes.valor_mensualidad` menos `descuento`).
- Distribución por estado de pago, plan y categoría.
- Pagos pendientes de verificación.

Si las consultas se vuelven lentas con volumen real, se evalúa una vista materializada. No antes.

### 8.5 Retiro de afiliados

Retirar es una operación explícita: fija `activo = false`, `fecha_retiro` y `motivo_retiro` en una sola transacción. No se borran datos históricos.

## 9. Diseño de la API

### Convenciones

- REST con JSON, prefijo `/api/v1`.
- Nombres de recursos en plural y en español, igual que las tablas.
- Paginación por `limit` y `cursor` (máximo 100 por página).
- Errores con formato uniforme: `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
- Códigos HTTP: 200/201 éxito, 400 validación, 401 sin sesión, 403 sin permiso por rol, 404 no encontrado (incluye otro tenant), 409 conflicto (duplicados), 500 error interno sin detalles técnicos.
- Los identificadores de la API son los `id` de la base.

### Endpoints del MVP

| Recurso | Operaciones |
| --- | --- |
| `/me` | GET: usuario, rol y organización |
| `/usuarios` | CRUD (solo admin) |
| `/planes`, `/categorias` | CRUD (escritura solo admin) |
| `/eps` | GET (catálogo global) |
| `/afiliados` | GET con filtros (`q`, `activo`, `categoria`, `plan`, `estado_pago`), POST, GET/PATCH por id |
| `/afiliados/:id/retiro` | POST |
| `/afiliados/:id/acudientes` | GET, POST |
| `/acudientes/:id` | PATCH, DELETE |
| `/pagos` | GET con filtros, POST (pago con líneas) |
| `/pagos/:id` | GET |
| `/pagos/:id/estado` | PATCH (verificar o rechazar) |
| `/archivos/subida` | POST: devuelve URL firmada de subida |
| `/archivos/lectura` | POST: devuelve URL firmada temporal de lectura |
| `/dashboard/resumen`, `/dashboard/morosidad`, `/dashboard/recaudo` | GET |

## 10. Archivos y documentos

- **Almacenamiento:** Supabase Storage, buckets **privados**: `comprobantes` y `documentos-afiliados`.
- **Ruta de objeto:** `{organizacion_id}/{tipo}/{uuid}.{ext}`, de modo que el prefijo identifica al tenant.
- **Subida:** el cliente pide a la API una URL firmada; la API verifica el rol, el tipo de archivo permitido (PDF, JPG, PNG, WEBP) y el tamaño máximo, y fija la ruta con el tenant de la sesión. El navegador sube directo a Storage.
- **Base de datos:** `url_comprobante` y `url_documentos` guardan la **ruta del objeto**, no una URL pública.
- **Lectura:** siempre mediante URL firmada de corta duración generada por la API tras verificar el tenant.
- **Tamaño:** el formulario actual admite hasta 100 MB. Para el MVP se propone un máximo de 10 MB por archivo, a validar con el cliente y con el límite del plan de Supabase.

## 11. Seguridad y protección de datos

- **Ley 1581 de 2012 (habeas data):** los datos de salud (EPS, tipo de sangre) y de menores son sensibles. Se exige consentimiento registrado con fecha (`fecha_consentimiento`) y evidencia documental.
- **Mínimo privilegio:** acceso a datos solo por rol de servidor; clave anónima sin acceso (RLS activo).
- **Secretos:** solo en variables de entorno de Vercel, separadas por entorno. Nunca en el repositorio.
- **Transporte:** solo HTTPS.
- **Cabeceras y CORS:** la API solo acepta peticiones del mismo origen; cabeceras de seguridad estándar configuradas en Vercel.
- **Protección de la entrada:** consultas parametrizadas por el ORM, validación Zod en todo endpoint, límite de tamaño de cuerpo.
- **Limitación de tasa:** límite básico en el login y en endpoints de subida de archivos.
- **Auditoría mínima:** registrar en logs quién verifica o rechaza un pago y quién retira a un afiliado. Una tabla de auditoría dedicada queda como mejora futura.
- **Respaldos:** confirmar la política de copias de seguridad del plan de Supabase y definir con Truchas la retención esperada.

## 12. Entornos, despliegue y operación

| Entorno | Frontend/API | Base de datos y Storage |
| --- | --- | --- |
| Local | `astro dev` | Supabase local (CLI) o proyecto de desarrollo |
| Preview | Despliegue por rama en Vercel | Proyecto Supabase de staging |
| Producción | Rama `main` en Vercel | Proyecto Supabase de producción |

- **CI (GitHub Actions):** instalar, verificar tipos, lint, pruebas y compilar en cada pull request.
- **Migraciones:** se aplican a staging automáticamente y a producción con paso manual de aprobación.
- **Observabilidad:** logs de Vercel y de Supabase en el MVP; añadir Sentry para errores cuando haya usuarios reales.
- **Variables de entorno:** validadas con Zod al arrancar; la aplicación falla rápido si falta alguna.

## 13. Estrategia de pruebas

- **Unitarias (Vitest):** reglas de negocio puras (cálculo de estado de pago, validación de pagos, cálculo de cartera).
- **Integración (Vitest + Postgres real):** servicios y repositorios contra una base local con las migraciones aplicadas.
- **Aislamiento entre tenants (obligatorias):** para cada recurso, crear datos en dos organizaciones y comprobar que ninguna operación de una alcanza datos de la otra, incluida la intención de referenciar un plan o afiliado ajeno.
- **Extremo a extremo (Playwright):** login, alta de afiliado, registro de pago con varios meses, verificación de pago y lectura del dashboard.
- **Criterio de calidad:** ningún cambio en cálculo de pagos o aislamiento entra sin pruebas.

## 14. Migración desde Google Sheets

1. **Script de importación** en TypeScript, ejecutado una sola vez por el equipo (no es una función de la aplicación en el MVP).
2. **Hoja de base de datos:** cada fila crea un afiliado; `Plan` y `Categoría 2026` se resuelven contra `planes` y `categorias`; `EPS` se normaliza contra el catálogo `eps` (los valores sin coincidencia se revisan a mano).
3. **Hoja de mensualidad:** la matriz afiliado por mes se "despivota": cada celda con valor genera una línea de `pago_detalle`, agrupada en un pago histórico por afiliado y mes, con estado `verificado`.
4. **Columnas descartadas del MVP:** `Sede/Día/Hora 1 a 6` y las de póliza se conservan en un archivo de respaldo para fases futuras. `Edad`, `Rango de edad`, `Mes/Día nacimiento`, `Mes/Año ingreso` y `Mes/Año retiro` son derivados y no se migran.
5. **Limpieza previa:** documentos con puntos o espacios, tipos de documento inconsistentes, EPS escritas de varias formas y fechas mal formateadas se corrigen antes de insertar.
6. **Validación posterior:** conteo de afiliados y suma de montos por mes comparados contra la hoja original.
7. **Ensayo:** primero en staging; producción solo tras revisión con Truchas.

## 15. Registro de decisiones

| # | Decisión | Alternativa descartada | Motivo |
| --- | --- | --- | --- |
| 1 | API en TypeScript dentro de Astro en Vercel | ASP.NET Core en hosting aparte | Un lenguaje, un despliegue, tipos compartidos |
| 2 | Hono como router | Endpoints Astro sueltos | Middleware, validación y portabilidad |
| 3 | Drizzle ORM | Prisma, solo `supabase-js` | Transacciones, SQL cercano, claves compuestas |
| 4 | Supabase Auth | `password_hash` propio | No reimplementar autenticación |
| 5 | `organizacion_id` desde la sesión + FK compuestas + RLS denegando acceso público | Confiar solo en filtros por endpoint | Defensa en capas contra fugas entre tenants |
| 6 | Pago dividido en `pagos` y `pago_detalle` | Una fila por mes | Pagos de varios meses y varios nadadores |
| 7 | Estado de pago calculado en vista | Columna almacenada | Se desactualiza a diario |
| 8 | Archivos en Storage con URLs firmadas | Binarios en la base | Costo, límites y privacidad |
| 9 | Montos como cadenas decimales | `number` | Evitar errores de punto flotante |
| 10 | Retiro lógico, no borrado | Eliminar afiliados | Conservar histórico y pagos |

## 16. Supuestos y pendientes con el cliente

1. Meses facturables de Truchas (febrero a diciembre) y su parametrización por organización.
2. Día límite de pago y ventana de "Por vencer".
3. Si un afiliado puede tener más de un acudiente.
4. Reglas de descuento (hermanos, plan anual, becas).
5. Qué es la póliza, quién la paga y si entra en una fase posterior.
6. Tamaño máximo de archivos y tipos aceptados.
7. Perfiles reales de usuarios y permisos de cada uno.
8. Política de retención de datos y de respaldos.

## 17. Evolución prevista

- Módulo de clases y horarios (sedes, horarios, asistencia).
- Póliza por año.
- Conciliación asistida de comprobantes (OCR) y facturación electrónica.
- Notificaciones de mora por correo o WhatsApp.
- Tabla de auditoría y políticas RLS por tenant.
- Importación de datos desde la propia aplicación para nuevos clientes.
