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
- **Orden por columna** con clic en el encabezado de **Afiliado** y **Documento** (A-Z ⇄ Z-A), que viaja a la API como `orden`/`direccion` y se refleja en la URL. El orden y la paginación los sigue haciendo la API (cursor opaco); `q` sigue siendo el filtro de texto de esas dos columnas.
- Al hacer clic en una fila se abre un panel lateral con sus datos, acudientes, historial de pagos y la acción **Retirar**.
- Crear y editar usan un formulario por secciones (identificación, contacto y salud, plan y curso, acudiente) con los mismos esquemas Zod de `src/shared`.
- Número de documento: alfanumérico en mayúsculas, solo dígitos para CC y TI (spec técnico, §7).

### 4.4 `/pagos`

Endpoints: `/pagos`, `/pagos/:id`, `/pagos/:id/estado`, `/dashboard/morosidad`, `/archivos/subida`, `/archivos/lectura`. Tres pestañas:

1. **Por verificar** (la bandeja de trabajo diaria): pagos en estado `pendiente`. Al abrir uno se ve el comprobante junto a los datos y los botones **Verificar** y **Rechazar**. Rechazar libera los meses, y la interfaz debe decirlo explícitamente.
2. **Historial:** todos los pagos, con filtros en los **encabezados de columna** (como en `/afiliados`): Estado (desplegable), Registrado y Revisado (fecha **única o rango**) y Factura (texto parcial sobre nombre/documento). Fecha única = desde y hasta iguales.
3. **Cartera:** quiénes deben qué meses, con acceso directo a "Registrar pago".

### 4.5 `/pagos/nuevo` (Registrar pago)

Página aparte, no panel, por ser el formulario más complejo:

- Buscar nadador(es), por nombre o por documento.
- Marcar, **por cada nadador**, sus meses con año —desde *su* mes de ingreso hasta diciembre del año en curso, mezclando años en un mismo pago (dic-25 + feb-26)— y su matrícula opcional (valor sugerido desde el plan). Nunca meses previos a la inscripción: la API también lo rechaza.
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
2. **Orden de columnas.** La paginación es por cursor y no hay ordenamiento configurable: las tablas no podrán ordenarse por cualquier columna ni mostrar números de página. Para el MVP bastan los botones "anterior" y "siguiente". *(Parcialmente resuelto Post-Fase 5: `/afiliados` ordena por Afiliado/Documento con `orden`/`direccion` — decisión 51. Sigue pendiente el orden arbitrario por cualquier columna y los números de página.)*
3. ~~**Búsqueda en afiliados.**~~ **CONFIRMADO (Fase 1, Paso 0).** `/afiliados?q=` busca por nombre y por documento; cubierto por prueba de integración (`GET /afiliados?q=` por documento y por nombre, case-insensitive).
4. **Reactivar plan o categoría.** `planActualizacionSchema` y `categoriaActualizacionSchema` no aceptan `activo`/`activa`: el `DELETE` es baja única (la Fase 5 lo confirmó al implementar la UI). La aplicación avisa que la desactivación no se puede deshacer desde la app; hoy la única vía de recuperar un plan o categoría dado de baja es SQL directo. Sí existe reactivación para usuarios (`PATCH {activo: true}`). *(Nuevo en Fase 5.)*

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
| 19 | Fase 2: colores de Recharts fijados por CSS (`src/styles/graficos.css`) con `var()` del tema; sectores de la dona con `style` inline | Colores en atributos `fill`/`stroke` de Recharts | Los atributos SVG NO resuelven `var()` del tema: por CSS (y `style`, que es CSS real) los gráficos siguen el modo oscuro sin re-render de React |
| 20 | Fase 2: `serieRecaudo` separa `magnitud` (Number, solo escala la geometría de las barras) de `total` (string, el que formatea el tooltip) | Pasar el string a Recharts / convertir y mostrar el number | La regla §5 prohíbe calcular montos con `number`: renderizar no es calcular, y todo monto reportado sale del string con `formatearDinero` |
| 21 | Fase 2: los morosos se ordenan con `centavosDesdeCadena` (enteros exactos, convención §6 del spec técnico) | Orden lexicográfico de strings (mal: `9000.00` > `10000.00`) o `parseFloat` | El endpoint no ordena; el orden en centavos es exacto y no es aritmética flotante |
| 22 | Fase 2: los enlaces del dashboard apuntan a `/afiliados?estado=en_mora` | Ruta inventada `/afiliados?filtrar=...` | El contrato lo fija §4.2 («enlaza a Afiliados ya filtrado por En mora»): la Fase 3 de afiliados leerá `?estado=` con los valores del schema (`al_dia`\|`por_vencer`\|`en_mora`) |
| 23 | Fase 3: `z.config(z.locales.es())` en `src/lib/afiliados-datos.ts` (solo el bundle del cliente) | Agregar `message:` en español campo por campo a `src/shared` / mensajes en inglés de Zod en la UI | Mensajes en español para todo lo que valide el cliente sin duplicar los esquemas compartidos ni tocar el backend; los tests del backend corren en proceso aislado, así que su locale no cambia |
| 24 | Fase 3: el formulario reutiliza `afiliadoCreacionSchema` (`.extend({ acudiente })` + refinements de UI: «Requerido»/«Selecciona…» solo para lo vacío) y en edición manda el PATCH completo con ese mismo esquema; el acudiente del alta se crea en un segundo paso con `acudienteCreacionSchema` (`es_principal: true`, único del alta) y en edición se gestiona desde el panel | Esquema paralelo en el cliente / solo `afiliadoActualizacionSchema` (parcial, permite guardar vacíos) | §4.3 pide «los mismos esquemas Zod de src/shared»: en Zod 4 `extend` conserva el `superRefine` del par CC/TI, y el refinement de UI va DESPUÉS de los checks base, así que su mensaje es el que queda al aplanar los issues (verificado en test) |
| 25 | Fase 3: los opcionales vacíos se normalizan con `setValueAs` (`''` → `null` al cambiar) y al armar el body con `?? null` | Mandar `''` y que la API lo guarde / `z.preprocess` previo al schema | `''` rompería el `uuid`/`fecha` del schema compartido; en edición `null` borra el dato y en el alta lo deja vacío (paridad con la API) |
| 26 | Fase 3: TanStack Table fijado a la línea **v8** | v9 (recién salida: API nueva `ReactTable`/`createCoreRowModel`) | La spec fija TanStack Table como stack sin fijar mayor; v8 es la línea estable y documentada. Además la tabla NO ordena ni pagina por su cuenta: nombre ASC + cursor opaco los hace la API |
| 27 | Fase 3: los filtros del encabezado son estado del listado que viaja a la API, y se reflejan en la URL con `history.replaceState(history.state, …)` | Filtrado client-side / `pushState` por cada filtro | §4.3 pide filtros «coincidentes con los que soporta la API»; la URL hace compartible el filtro y lee el `?estado=` del dashboard (decisión 22) sin romper el historial del ClientRouter (se conserva `history.state`) |
| 28 | Fase 3: paginación con pila local de cursores (Anterior/Siguiente) que se reinicia en el mismo handler de cambio de filtro, y `keepPreviousData` entre páginas | Página en la URL / infinite scroll | El cursor es opaco (§9) y solo la API conoce el orden; `keepPreviousData` evita el parpadeo al avanzar y el reset sincronizado evita consultar filtros con un cursor viejo |
| 29 | Fase 3: el panel de detalle se deriva de la página cargada (`find` por id); si el filtro activo saca al afiliado de la página, el panel se cierra solo | `GET /afiliados/{id}` en paralelo al listado | El listado ya trae el registro completo: una consulta menos y el panel siempre muestra los datos visibles; editar/retirar refresca con `invalidateQueries(['afiliados'])`. El botón Retirar solo se pinta para admin (la seguridad sigue en la API con `requerirRol('admin')`) |
| 30 | Fase 3: en openapi-fetch los query/path van en `params.query` / `params.path` | `query` top-level (casi se embarca: compilaba) | El tipo lo acepta por el catch-all `[key: string]: unknown`, pero el runtime v0.17 solo lee `params.*`: los filtros habrían viajado vacíos en silencio y la API habría devuelto todo |
| 31 | Fase 4: los filtros de `/pagos` (y la pestaña activa) viven solo en el estado del componente, sin reflejarse en la URL | Reusar el espejo de URL de la Fase 3 | §4.4 no lo pide: `/pagos` es una bandeja de trabajo diaria, no un enlace compartible; menos estado que mantener sincronizado con el ClientRouter |
| 32 | Fase 4: el total del formulario se suma con **decimal.js** (dependencia nueva) y `monto_total` se deriva de las líneas en cada render, recalculándose al enviar | Centavos enteros con `centavosDesdeCadena` (patrón existente del cliente) | §5 lo prescribe literalmente para este formulario («se suma con una librería decimal, no con `+`»); ambas son exactas, se sigue la spec y la API revalida la igualdad igualmente |
| 33 | Fase 4: la mensualidad sugerida aplica el descuento del afiliado (`plan × (1 − descuento)` con decimal.js, espejo exacto de los centavos de `services/dashboard.ts`); la matrícula va cruda del plan; ambos valores son editables | Valor crudo del plan (lectura literal de §4.5) | «Cartera → Registrar pago» debe proponer exactamente lo adeudado: `valor_adeudado` usa esa misma fórmula; sugerir el precio lleno a un afiliado con descuento sería un error de cobro |
| 34 | Fase 4: el formulario ofrece año actual y anterior además de los meses febrero–diciembre | Solo el año actual | `meses_adeudados` se calcula desde `fecha_ingreso`: quien ingresó el año previo adeuda meses de ese año y con un solo año no se les podría cobrar |
| 35 | Fase 4: el comprobante es OBLIGATORIO en el alta (el API lo acepta nullish) | Opcional como en el wire | La pestaña Por verificar existe para contrastar el comprobante contra los datos: un pago sin él no es verificable; §4.5 lo lista como paso del formulario |
| 36 | Fase 4: el detalle del panel resuelve los nombres de las líneas con una consulta por `afiliado_id` (`useQueries`) | Traer el listado de afiliados y hacer `find` | Las líneas solo traen el id; el listado paginado (máx 100) no garantiza cubrirlos, y en el caso típico (1–4 nadadores por pago) son pocas consultas con caché compartida |
| 37 | Fase 4 (Zod): `esquemaFacturacion` valida el tipo con `refine` de membresía + `pipe` al enum, nunca `z.enum` crudo en un campo con opción vacía | `z.enum` directo (como en `afiliadoCreacionSchema`) | En Zod 4 un issue `invalid_value` del enum **aborta el refinamiento**: con el select en «— Selecciona —» el `superRefine` entero no corre y se pierden todos los mensajes «Requerido» (verificado con test). Los esquemas de la Fase 3 sobreviven porque sus selects SIEMPRE tienen default válido |
| 38 | Fase 4: subir comprobante = `POST /archivos/subida` → `PUT` del `File` a la URL firmada → `url_comprobante = ruta` en el body del pago; verlo = `POST /archivos/lectura` al abrir el panel | Guardar la URL firmada / cachearla | §10: el API no recibe binarios. La firma de lectura vive 5 minutos: se pide en el momento (queryKey por ruta) para no mostrar una URL vencida |
| 39 | Fase 4: tras Verificar/Rechazar se cierra el panel y se invalida `['pagos']`, `['dashboard']` y `['afiliados']` | Mantener el panel abierto mostrando el nuevo estado | La bandeja es secuencial: al decidir, el operador sigue con el siguiente pago; el estado del afiliado y la cartera cambian con las líneas liberadas |
| 40 | Fase 5: planes y categorías reutilizan `usePlanes`/`useCategorias` de Fase 3 (mismo queryKey) en lugar de duplicar hooks en `consultas-admin` | Hooks nuevos por pestaña de admin | Un solo punto de verdad por catálogo: editar un plan en `/admin` invalida `['afiliados']` y refresca también los selectores de `/afiliados` y `/pagos/nuevo`, y al revés |
| 41 | Fase 5: los listados de admin son tablas HTML simples (mismo estilo que Cartera), no TanStack Table; los catálogos se piden con `limit=100` sin cursor | TanStack Table con orden y paginación | Las filas llevan acciones en línea (select de rol, Editar/Desactivar), son pocos registros y §4.6 no pide ordenar ni filtrar; TanStack solo añadiría complejidad |
| 42 | Fase 5: usuarios se listan TODOS (activos e inactivos) en una sola página de 100, sin filtros | Filtro por estado + paginación por cursor | Una organización tiene pocas cuentas y las inactivas deben verse para poder reactivarlas |
| 43 | Fase 5: la fila propia no ofrece «Desactivar» (dice «Tu cuenta»); el cambio de rol propio sí se permite | Ocultar también el cambio de rol | El API solo prohíbe la autodesactivación (409 «No puede desactivar su propia cuenta»); la UI replica esa única regla que cambia la experiencia y el cambio de rol no está prohibido. La seguridad sigue en el 403 por rol |
| 44 | Fase 5: desactivar un plan o categoría es ONE-WAY y el copy lo dice explícitamente («no podrás reactivarlo desde la aplicación»); para usuarios sí hay «Reactivar» | Ocultar la restricción o inventar un botón de reactivación | `planActualizacionSchema`/`categoriaActualizacionSchema` no aceptan el flag de estado y el `DELETE` solo pone `activo=false`; el hueco quedó anotado en §6.4. `usuarioActualizacionSchema` sí acepta `activo: true` |
| 45 | Fase 5 (Zod/RHF): los mensajes «Requerido»/«Selecciona…» se colocan donde zodResolver los MUESTRA: `superRefine` a nivel de campo DESPUÉS de checks base que pasan con vacío, y `refine`+`pipe` antes del enum (patrón 37) | `superRefine` al final del objeto (patrón de la Fase 3) | El resolver (v6 + Zod 4) dibuja el **primer** issue de cada campo, no el último: con el patrón viejo el formulario mostraría «Demasiado pequeño…»/«Inválido UUID» en vez del mensaje amable (verificado contra el fuente de `@hookform/resolvers` y con un parse real). `flatten().at(-1)`, que es lo que afirman los tests de la Fase 3, NO es lo que se ve en pantalla — los tests de la Fase 5 afirman ambas posiciones |
| 46 | Post-Fase 5: ninguna línea de pago puede ser **anterior al mes de ingreso** del nadador — validado en el service con las fechas de la base (400 `VALIDACION`) y acotando en el cliente los meses ofrecidos (`mesesCobrablesDe`) | Validar solo en el cliente / dejarlo libre | Bug reportado: se podía cobrar ago-2025 a quien ingresó oct-2025; al verificar, `mesesAdeudados` arranca en `fecha_ingreso` (§8.3) y la deuda no bajaba — mismo síntoma que el pago verificado sin efecto. La regla es por MES (`'AAAA-MM'` comparado como clave, igual para mensualidad y matrícula). El mes de ingreso **sí** es cobrable aunque no sea exigible: decisión simple, lo decide el operador |
| 47 | Post-Fase 5: la API rechaza mensualidades de **enero** («enero lo cubre la matrícula») en `pagoCreacionSchema` | Aceptarla como cualquier otro mes | `MESES_FACTURABLES` (§8.3) excluye enero: un pago de enero se verificaría sin efecto sobre la deuda — la misma clase de bug de las decisiones 46/A5 |
| 48 | Post-Fase 5: los meses se marcan **por nadador** con claves `'AAAA-MM'` (multi-año en un mismo pago), desde su mes de ingreso hasta diciembre del año en curso; la matrícula también es por nadador con año elegible hasta el año en curso | Selector global de año+meses aplicado a todos los nadadores | Un pago de familia puede cubrir dic-25 de un hermano y feb-26 de otro; y que todos compartieran los mismos meses era incorrecto. Los meses disponibles salen de `fecha_ingreso` de cada nadador (decisión 46) |
| 49 | Post-Fase 5: los chips de meses adeudados de la Cartera muestran el **año** (`nov 2025`) | `nov` suelto | La cartera cruza dos ejercicios (nov/dic + feb…oct) en la misma fila y sin año el operador no sabe de qué año habla |
| 50 | Post-Fase 5: los filtros del Historial viven en los **encabezados de columna** (Estado; Registrado y Revisado por fecha única o rango; Factura por texto parcial) y se eliminó la barra superior de fechas; la API suma `factura`, `revisado_desde` y `revisado_hasta` | Barra superior + solo filtro de estado (comportamiento Fase 4) | Petición explícita: filtrar «al igual que con afiliados»; los controles nuevos (`FiltroFecha`, `FiltroTexto`) replican el patrón sin Radix de `FiltroColumna`. Fecha única = desde = hasta, sin parámetro extra |
| 51 | Post-Fase 5: `/afiliados` ordena por Afiliado/Documento con clic en el encabezado (ASC⇄DESC) vía `orden`/`direccion` de la API, incluida la ruta con `estado_pago` (corte en memoria con la misma clave, dirección y cursor); el filtro por texto de esas columnas sigue siendo la búsqueda global `q` | Filtro de texto dedicado por columna / orden client-side | La spec delega orden y cursor a la API (§9) y `q` ya cubre «filtrar por Afiliado o Documento» (§6.3); ordenar en memoria paginada daría páginas inconsistentes |
| 52 | Post-Fase 5: `orden`/`direccion` viajan también a la URL de `/afiliados` y se restauran al cargar (`afiliados.astro`) | Estado de vista solo en memoria | Coherente con el espejo de URL de la filtros (decisión 27): el enlace con el orden activo queda compartible y sobrevive al refresco |

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
