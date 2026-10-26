# Membrio — Especificación del cliente web

Versión 0.1 · 24 de octubre de 2026 · Estado: borrador para el MVP (primer cliente: Truchas)

## 1. Propósito y alcance

Este documento define la interfaz del cliente web de Membrio, que convive en el mismo repositorio que la API. Se deriva del *Spec técnico de arquitectura* (roles en §4, API en §9) y de los endpoints ya implementados bajo `/api/v1`. Los valores marcados con `*` son derivados y deben afinarse al verlos en pantalla.

### Dentro del alcance del MVP

- Inicio de sesión.
- Dashboard de recaudo y cartera.
- Base de datos de afiliados (listado, filtros, detalle, alta, edición y retiro).
- Seguimiento de pagos (verificación, historial, cartera y registro de pagos).
- Administración para usuarios con rol admin (usuarios, planes y categorías).

### Fuera del alcance del MVP

- Parámetros de la organización editables (meses facturables, día límite): hoy son constantes de configuración y no tienen API.
- Programación de clases, asistencia y póliza (ver spec técnico, §1 y §17).
- Ordenamiento libre por columna y paginación numerada (la API pagina por cursor).
- Notificaciones de mora.

## 2. Identidad visual

### 2.1 Paleta

Los colores base salen de las capturas de Firefox (tema claro y oscuro).

| Token | Claro | Oscuro |
| --- | --- | --- |
| Fondo de página | `#F7F6FB` | `#131215` |
| Superficie (tarjetas, tablas) | `#FFFFFF` | `#1C1B22`* |
| Primario (botones, ítem activo) | `#764EDD` | `#B49CF5`* |
| Degradado de marca | durazno `#FEEDE5` → blanco | morado `#210340` → rojo oscuro `#451F1D` |
| Cálidos de acento | amarillo `#FFD43B`*, naranja `#FFA719`, rojo `#E5484D`* | los mismos, un tono más claro |

### 2.2 Reglas de uso

- **El degradado es decorativo y con medida.** Se usa en el fondo del login, en el encabezado del dashboard y en detalles puntuales. Nunca detrás de tablas ni de texto largo, porque quita legibilidad.
- **Los cálidos resuelven la semántica de los estados de pago.** Siempre con texto e ícono, no solo color (daltonismo y poco contraste del amarillo sobre fondo claro).

| Estado | Color | Ícono |
| --- | --- | --- |
| Al día | azul/teal | ✓ |
| Por vencer | amarillo/naranja | reloj |
| En mora | rojo | alerta |

- **Tema claro, oscuro o sistema.** Selector de tres estados como el de Firefox (Claro · Oscuro · Sistema), guardado como preferencia del usuario.
- **Contraste.** El primario `#764EDD` con texto blanco ronda 5,4:1 (cumple AA). Verificar el resto de combinaciones antes de fijar los tokens.
- Los tokens se implementan como variables CSS, de modo que el modo oscuro solo redefine valores.

### 2.3 Tipografía

**Inter** como fuente principal: es el estándar, se parece en espíritu al sans de Anthropic y tiene números tabulares (`tabular-nums`), importantes para que las columnas de montos alineen. Alternativa con más carácter: *Instrument Sans*. Se carga autoalojada (`@fontsource`), sin pedirla a Google.

## 3. Estructura de la app (shell)

- **Encabezado delgado** con "Membrio" centrado y nada más.
- **Menú lateral izquierdo, colapsable:** 240 px expandido y 64 px solo íconos; el estado se recuerda. En móvil pasa a cajón superpuesto.
- **Ítem activo:** fondo del color primario suave más una barra lateral, para que se vea claro dónde está el usuario.
- **Parte baja del menú:** nombre y rol del usuario, selector de tema y cerrar sesión.
- **Entradas:** Dashboard (página de inicio tras el login), Afiliados, Pagos y, solo para admin, Administración.

### 3.1 Cuidados

- **El menú se oculta por rol, pero no es la seguridad.** La API devuelve 403; el cliente solo evita mostrar lo que no se puede usar.
- **Vocabulario.** En la interfaz, **Afiliados** son los nadadores y **Usuarios** son las cuentas del sistema (solo dentro de Administración).

## 4. Rutas y páginas

| Ruta | Página | Rol |
| --- | --- | --- |
| `/login` | Inicio de sesión | Público |
| `/` | Dashboard | admin, operador |
| `/afiliados` | Listado y detalle de afiliados | admin, operador |
| `/pagos` | Seguimiento de pagos (tres pestañas) | admin, operador |
| `/pagos/nuevo` | Registrar pago | admin, operador |
| `/admin` | Administración (usuarios, planes, categorías) | admin |

### 4.1 `/login`

Tarjeta centrada sobre el degradado. En `AUTH_MODE=dev` pide solo el correo (es lo que acepta `dev-login`) y muestra una franja "Modo desarrollo"; con Supabase será correo y contraseña. Errores genéricos, sin revelar si el correo existe.

### 4.2 `/` Dashboard

Endpoints: `/dashboard/resumen`, `/dashboard/morosidad`, `/dashboard/recaudo`.

- Cuatro tarjetas: recaudo del mes, cartera pendiente, afiliados activos y pagos por verificar.
- Gráfico de barras de recaudo por mes y dona por estado de pago.
- Lista corta de los más morosos, que enlaza a Afiliados ya filtrados por "En mora".

### 4.3 `/afiliados`

Endpoints: `/afiliados`, `/afiliados/:id`, `/afiliados/:id/retiro`, `/afiliados/:id/acudientes`, `/acudientes/:id`, `/eps`, `/planes`, `/categorias`.

- Búsqueda de texto arriba (`q`) y filtros desplegables en el **encabezado de las columnas** categóricas: Categoría, Plan, Estado de pago y Activo. Coincide exactamente con los filtros que la API ya soporta.
- Al hacer clic en una fila se abre un panel lateral con sus datos, acudientes, historial de pagos y la acción **Retirar**.
- Crear y editar usan un formulario por secciones (identificación, contacto y salud, plan y curso, acudiente) con los mismos esquemas Zod de `src/shared`.
- Número de documento: alfanumérico en mayúsculas, solo dígitos para CC y TI (spec técnico, §7).

### 4.4 `/pagos`

Endpoints: `/pagos`, `/pagos/:id`, `/pagos/:id/estado`, `/dashboard/morosidad`, `/archivos/subida`, `/archivos/lectura`. Tres pestañas:

1. **Por verificar** (la bandeja de trabajo diaria): pagos en estado `pendiente`. Al abrir uno se ve el comprobante junto a los datos y los botones **Verificar** y **Rechazar**. Rechazar libera los meses, y la interfaz debe decirlo explícitamente.
2. **Historial:** todos los pagos, con filtros por estado y fecha.
3. **Cartera:** quiénes deben qué meses, con acceso directo a "Registrar pago".

### 4.5 `/pagos/nuevo` (Registrar pago)

Página aparte, no panel, por ser el formulario más complejo:

- Buscar nadador(es), por nombre o por documento.
- Marcar meses (febrero a diciembre) y matrícula opcional (valor sugerido desde el plan).
- Datos de facturación precargados pero editables, con tipo de documento obligatorio (TI, CC, RC, PAS, PPT o NIT).
- Subir comprobante (PDF, JPG, PNG o WEBP, máximo 10 MB) mediante URL firmada.
- Total calculado en pantalla, que debe coincidir con la suma de las líneas.

### 4.6 `/admin` (solo admin)

Pestañas **Usuarios** (crear, cambiar rol, desactivar), **Planes** (valores de mensualidad y matrícula) y **Categorías**. La pestaña **Parámetros** queda fuera del MVP (ver §1).

## 5. Decisiones técnicas del cliente

| Tema | Decisión |
| --- | --- |
| Estructura | Astro con layout compartido y React como islas; menú persistente entre páginas (`transition:persist`) |
| Estilos y componentes | Tailwind + shadcn/ui (accesible; modo oscuro y tokens por variables CSS) |
| Datos | TanStack Query (peticiones y caché), TanStack Table (tablas), React Hook Form con los esquemas Zod compartidos |
| Cliente de la API | Tipado desde `/api/v1/openapi.json` con `openapi-typescript`; si la API cambia, el cliente falla al compilar |
| Gráficos | Recharts |
| Dinero | Los montos llegan como cadenas y se formatean con `Intl.NumberFormat('es-CO', { currency: 'COP' })`, nunca como `number`. El total del formulario de pago se suma con una librería decimal (`decimal.js`), no con `+` |
| Fechas | `fecha_cobertura` siempre día 1; selector de mes. Zona de negocio `America/Bogota` |
| Errores | 401 redirige a login; 403 muestra "no tienes permiso"; 404, 409 y 422 muestran el mensaje de la API en el campo o en un aviso |
| Sesión | Cookie `httpOnly`; nada de tokens en `localStorage` (spec técnico, §4) |
| Idioma | Español (es-CO) |

## 6. Pendientes en la API que el cliente necesita

1. ~~**Sesión por cookie.**~~ **RESUELTO (Fase 1, Paso 0).** `dev-login` fija la cookie `membrio_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` = expiración del JWT, `Secure` solo en producción) y además sigue devolviendo el token en el cuerpo para Swagger y los curl. Nueva ruta `POST /api/v1/auth/logout` (204) que borra la cookie.
2. **Orden de columnas.** La paginación es por cursor y no hay ordenamiento configurable: las tablas no podrán ordenarse por cualquier columna ni mostrar números de página. Para el MVP bastan los botones "anterior" y "siguiente". *(Sigue pendiente; decisión de diseño.)*
3. ~~**Búsqueda en afiliados.**~~ **CONFIRMADO (Fase 1, Paso 0).** `/afiliados?q=` busca por nombre y por documento; cubierto por prueba de integración (`GET /afiliados?q=` por documento y por nombre, case-insensitive).

## 7. Registro de decisiones

| # | Decisión | Alternativa descartada | Motivo |
| --- | --- | --- | --- |
| 1 | Paleta derivada de Firefox, con degradado solo decorativo | Degradado como fondo general | Legibilidad de tablas y formularios |
| 2 | Estados de pago con color, texto e ícono | Solo color | Accesibilidad (daltonismo, contraste del amarillo) |
| 3 | Inter autoalojada | Fuente cargada desde un CDN de terceros | Números tabulares y sin peticiones externas |
| 4 | Filtros en el encabezado de columnas categóricas más búsqueda global | Filtro por cada columna de texto | Coincide con los filtros que soporta la API |
| 5 | Registrar pago como página aparte | Panel lateral | Formulario con varias líneas, facturación y comprobante |
| 6 | Cliente tipado desde el OpenAPI de la API | Tipos escritos a mano | Los cambios de contrato rompen al compilar |
| 7 | Suma de montos con librería decimal | Aritmética con `number` | Evitar errores de punto flotante (spec técnico, decisión 9) |
| 8 | Menú oculto por rol, seguridad en la API | Confiar en la interfaz | La autorización real es del servidor |
| 9 | Cookie `membrio_session` fijada por `dev-login` + `POST /auth/logout` (Fase 1, Paso 0) | Token solo en el body / `localStorage` | Spec técnico §4: nada de tokens en storage; el Bearer del body se mantiene para Swagger y curl |
| 10 | Defensa CSRF en `requerirAuth`: `Sec-Fetch-Site` si existe; si no, comparar host de `Origin` vs petición; sin cabeceras se permite (fail-open) y nunca aplica a Bearer ni a rutas sin sesión | Exigir siempre cabecera de origen (rompe curl y Swagger) | El cliente es mismo-origen; lo mutante protegido es lo autenticado por cookie (logout). `dev-login` es público: lo blindan CORS+preflight (JSON) y `SameSite=Lax` |
| 11 | Protección de rutas sin parpadeo en `src/middleware.ts` de Astro (jose, `iss: membrio`, `aud: membrio-api`, HS256) — verifica solo el JWT de la cookie, sin consultar la BD | Redirigir desde el cliente tras montar el contenido (habría parpadeo) | UX de navegación, no seguridad: la seguridad real es `requerirAuth` en cada petición de la API |
| 12 | `src/middleware.ts` (Astro) lee `process.env` en vez de importar `src/server` | Importar la config del backend desde el glue de Astro | El cliente nunca importa de `src/server` (restricción de estructura); la duplicación son ~6 líneas |
| 13 | Esquema de login duplicado en `src/shared/sesion.ts` (espejo de `routes/auth.ts`) | Tocar el backend para unificarlo | Fuera del alcance de la Fase 1 (solo el Paso 0 habilita cambios de API); unificar cuando auth vuelva a modificarse |
| 14 | `formatearDinero` valida con `esDecimal` ANTES de darle el string a `Intl` y lanza `TypeError` si no lo es | Confiar en `Intl` | Probado: `Intl` **no** valida — con basura pinta `$ NaN` y con `''` pinta `$ 0`. Para dinero, mejor romper en desarrollo que pintar un monto falso |
| 15 | `.pnpmfile.cjs` anida `typescript@^5` solo en `openapi-typescript` | Bajar el TypeScript raíz a 5.x | El repo usa TS 7 (nativo, sin compiler API) y `openapi-typescript` declara peer `^5.x`: sin el hook, `pnpm api:types` revienta en `ts.factory` |
| 16 | Componentes shadcn/ui sin Radix/`asChild` por ahora | Instalar `@radix-ui/react-slot` sin uso real | Fase 1 no necesita botones-enlace; si un `shadcn add` futuro lo pide, se instala entonces |
| 17 | El script anti-parpadeo de tema vive duplicado en el `<head>` (`is:inline`) de ambos layouts | Importar `src/lib/tema.ts` desde el head | `is:inline` no puede importar módulos; es ~6 líneas con comentario cruzado. Cliente y servidor no se pelean por el atributo `class` |
| 18 | Único toque de backend en la Fase 1: cast de tipos `bytes as Uint8Array<ArrayBuffer>` en `routes/archivos.ts` (`new Response`) | Usar `bytes.buffer` o tocar las interfaces de `storage/` | Al sumar `lib: ["DOM"]` para React, `BodyInit` exige `Uint8Array<ArrayBuffer>` y la interfaz declara el genérico (`ArrayBufferLike`). `readFile` entrega `Buffer` con `ArrayBuffer` plano ⇒ cast honesto, cero cambio de runtime. `bytes.buffer` sería PELIGROSO: con pooling puede ser más grande que la vista y enviaría bytes de más |

## 8. Supuestos y pendientes

1. Los hexadecimales marcados con `*` son derivados y se ajustan al verlos en pantalla.
2. Inter como fuente definitiva (alternativa: Instrument Sans).
3. Las tres pestañas de `/pagos` (Por verificar, Historial, Cartera) son una propuesta: confirmar con Truchas cuál es el flujo diario real del operador.
4. La pestaña **Parámetros** del admin queda fuera del MVP hasta que exista una API para ella.
5. El pendiente 2 de §6 (orden de columnas). Los pendientes 1 y 3 quedaron resueltos en la Fase 1.
6. Perfiles reales de usuarios y permisos (spec técnico, §16, punto 7): la interfaz asume solo admin y operador.

## 9. Plan por fases (propuesto)

Con un punto de revisión al final de cada fase:

1. **Shell y login:** tokens de diseño, tema claro/oscuro, layout con menú colapsable, página de login y manejo de sesión.
2. **Dashboard:** tarjetas, gráficos y lista de morosos.
3. **Afiliados:** listado con filtros, panel de detalle, formulario de alta y edición, retiro y acudientes.
4. **Pagos:** pestañas Por verificar, Historial y Cartera, y registro de pagos con comprobante.
5. **Administración:** usuarios, planes y categorías.
