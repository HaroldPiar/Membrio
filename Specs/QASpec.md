# Membrio — QASpec (tanda de corrección de bugs)

Spec de la ronda de QA post-Fase 5. Resume las **6 unidades de trabajo** a
corregir, con la causa raíz confirmada, los archivos a tocar, la definición de
«terminado» y las pruebas manuales que realiza el usuario.

- **Fecha de creación:** 2026-10-28.
- **Origen:** reporte manual del usuario sobre `/afiliados`, `/pagos`, Dashboard
  y `/login`.
- **Criterio de la ronda:** cada unidad se ejecuta, documenta y verifica por
  separado; al final se corren los gates completos (`typecheck`, `test`,
  `test:integracion`, `build`, smoke `:4399`).
- **Convenciones del repo siguen vigentes:** ver `AGENTS.md` (invariantes,
  comandos) y `Specs/Spec del cliente.md` §7 (registro de decisiones).

---

## Estado de la ronda

| Unidad | Alcance | Estado |
| --- | --- | --- |
| 1 | Filtro `ACTIVO` → «Retirados» no filtra (bug de contrato) | ✅ Hecha (typecheck · 151 unit · 30 integración) |
| 2 | Panel de detalle: historial de pagos + meses adeudados + scroll de edición | ✅ Hecha (typecheck · 151 unit · 34 integración · build · smoke :4399) |
| 3 | Filtros de `/afiliados`: panel recortado y estado vacío sin salida | ✅ Hecha (typecheck · 154 unit · 34 integración · build) |
| 4 | Dashboard: chips con año + enlace a Cartera, dona con hover y navegación | ✅ Hecha (typecheck · 157 unit · 34 integración · build · smoke :4399) |
| 5 | `/pagos` Cartera (botón «Registrar pago») + toggle de tema en `/login` | ✅ Hecha (typecheck · 157 unit · build · smoke :4399) |
| 6 | Plan desactivado sigue apareciendo en el formulario de afiliados | ✅ Hecha (typecheck · 162 unit · 34 integración · build) |

---

## Unidad 1 — Filtro `ACTIVO`: «Retirados» muestra activos

**Síntoma.** En `/afiliados`, filtrar por `ACTIVO → Retirados` devuelve solo
afiliados **activos**. `ACTIVO → Activos` se comporta bien. Ejemplo reportado:
Camila Herrera López, CC 45123987 (retirada), no aparece bajo «Retirados».

**Causa raíz (confirmada).** `src/shared/afiliados.ts` declara

```ts
activo: z.coerce.boolean().optional()
```

En Zod 4 (`4.6.7`), `z.coerce.boolean()` aplica `Boolean(valor)` al string de
la query, y `Boolean('false') === true`. El cliente envía `?activo=false`, la
API lo valida como `true` y devuelve los activos. Verificado con:

```
z.coerce.boolean().parse('false')  // → true
z.coerce.boolean().parse('true')   // → true
```

**Corrección.**

- Reemplazar `z.coerce.boolean()` por un `z.preprocess` que traduzca
  `'true'`/`'false'` (y los booleanos ya tipados) a `boolean` real, manteniendo
  `.optional()` y el tipo `boolean | undefined` del schema.
- Mantener el `openapi()` con la misma descripción y ejemplo.
- Regenerar `src/lib/tipos-api.ts` con `pnpm api:types` (cambio de contrato).

**Archivos.** `src/shared/afiliados.ts`, `src/lib/tipos-api.ts`.

**Tests.**

- Unitario: nuevo caso en `tests/unit/afiliados-datos.test.ts` (o archivo
  dedicado de schemas) que afirme que `'false' → false`, `'true' → true` y
  ausente → `undefined`.
- Integración: en `tests/integracion/pagos-nuevas-reglas.test.ts` (o archivo
  propio) un `GET /api/v1/afiliados?activo=false` que afirme que **todas** las
  filas tienen `activo: false` y que hay al menos una fila retirada en la
  semilla.

**Terminado cuando.** `?activo=false` devuelve solo retirados, `?activo=true`
solo activos, sin parámetro devuelve ambos; gates en verde.

**Verificación manual (usuario).** `/afiliados` → filtro `ACTIVO → Retirados`
muestra a Camila Herrera López (CC 45123987) y ningún activo; `Activos` muestra
solo activos; «Todos» (vacío) muestra ambos.

---

## Unidad 2 — Panel de detalle: historial de pagos, meses que debe y scroll

**Síntomas.**

1. En `/afiliados` → tarjeta de un afiliado → sección **Historial de pagos**:
   solo se ve monto y estado. Se pide:
   - para los **verificados**: monto, **mes (con año)** al que corresponde,
     fecha y hora del pago (`created_at`, ya se muestra);
   - una **sección aparte** con los **meses que debe**.
2. Al **editar** un registro desde `/afiliados`, el formulario **no deja
   hacer scroll**.

**Causa raíz.**

1. `src/components/afiliados/panel-detalle.tsx` renderiza por pago únicamente
   `monto_total`, `created_at` y `estado`; no desmenuza `lineas` (cada línea
   tiene `fecha_cobertura` = día 1, de donde sale el mes/año) ni muestra la
   deuda. El mes con año ya existe como helper `etiquetaMesLarga` /
   `etiquetaMesChip` en `src/lib/dashboard-datos.ts`.
2. `src/components/afiliados/afiliados.tsx` pone
   `document.body.style.overflow = 'hidden'` mientras el panel de detalle está
   abierto. Al pulsar «Editar» cambia `vista` a `'formulario'` pero
   `seleccion` no se limpia, así que el `useEffect` del lock no corre su
   limpieza y el `body` queda sin scroll en la vista de formulario.

**Corrección.**

1. Reescribir la sección «Historial de pagos» del panel:
   - por cada pago, listar sus líneas con mes+año de `fecha_cobertura`,
     concepto (mensualidad/matrícula) y monto de la línea; cabecera con
     `monto_total`, `created_at` (fecha y hora) y `EstadoVerificacion`;
   - agregar sección **«Meses que debe»** con chips (con año) de
     `meses_adeudados` calculados para ese afiliado, o «Sin meses adeudados».
   - decisión de diseño: reutilizar `etiquetaMesLarga`/`etiquetaMesChip` de
     `dashboard-datos.ts` (cliente puede importar `src/lib` sin problema).
2. Corregir el lock de scroll: restaurar `document.body.style.overflow` al
   entrar a `vista.tipo === 'formulario'` (o desactivar el lock cuando
   `seleccion` no corresponde a la vista visible).

**Archivos.** `src/components/afiliados/panel-detalle.tsx`,
`src/components/afiliados/afiliados.tsx`.

**Tests.** Unitario puro para cualquier transformación nueva de líneas →
mes/año en `src/lib/afiliados-datos.ts` (tests en
`tests/unit/afiliados-datos.test.ts`). El lock de scroll es efecto de React,
se cubre a mano.

**Terminado cuando.** El historial muestra mes+año por línea verificada, hay
sección de meses adeudados, y el formulario de edición hace scroll.

**Verificación manual (usuario).** Abrir una tarjeta con pagos verificados →
ver mes/año y fecha+hora; ver «Meses que debe» con chips; entrar a **Editar** →
el formulario hace scroll.

---

## Unidad 3 — Filtros de `/afiliados`: panel recortado y estado vacío

**Síntomas.**

1. Con la tabla reducida (p. ej. 1 fila), al reabrir un filtro el panel queda
   **dentro del tamaño de la tabla** y hay que hacer scroll para llegar a las
   últimas opciones.
2. Al elegir un filtro sin coincidencias (p. ej. `PLAN: Medio`, o
   `ESTADO DE PAGO: Por vencer`), la tabla muestra el estado vacío
   «Nadie coincide con los filtros actuales…» pero **desaparecen las columnas**
   y con ellas el control del filtro: no se puede quitar sin salir y volver a
   entrar al submenu.

**Causa raíz.**

1. `src/components/ui/filtro-columna.tsx` renderiza el panel con
   `position: absolute` dentro del contenedor de la tabla, que recorta con su
   propio `overflow`.
2. `src/components/afiliados/tabla-afiliados.tsx` + `afiliados.tsx`: cuando
   `filas.length === 0` se renderiza `EstadoVacio` **en lugar de** la tabla, y
   `EstadoVacio` no arrastra los encabezados ni un botón de limpieza.

**Corrección.**

1. Sacar el panel del contexto de recorte: posicionarlo con
   `position: fixed` calculado desde el `getBoundingClientRect()` del botón, o
   montarlo en un portal fuera de la tabla; mantener el cierre al hacer clic
   afuera / `Escape` y el `aria-*` actual.
2. En el estado vacío **mantener la fila de encabezados con los filtros**
   (tabla sin cuerpo) **o** añadir un botón «Limpiar filtros» visible en el
   estado vacío (mismo estilo del que ya existe en la cabecera del listado).
   Preferencia: mantener encabezados + botón «Limpiar filtros» en el vacío, de
   modo que la salida sea inmediata en el mismo sitio.

**Archivos.** `src/components/ui/filtro-columna.tsx`,
`src/components/afiliados/tabla-afiliados.tsx`,
`src/components/afiliados/afiliados.tsx`, `src/components/ui/estado-vacio.tsx`.

**Tests.** Unitario para la lógica pura de posición (si se extrae) en
`tests/unit/`. La posición del panel y el render del vacío se verifican a mano.

**Terminado cuando.** El panel se ve completo con 1 fila, y con un filtro sin
coincidencias se puede quitar el filtro sin salir del submenu.

**Verificación manual (usuario).** Filtrar `PLAN: Medio` (0 resultados) → ver
encabezados y poder limpiar; reducir la tabla a 1 fila → abrir cualquier filtro
→ todas las opciones visibles sin scroll interno.

---

## Unidad 4 — Dashboard: chips con año, enlace a Cartera y dona navegable

**Síntomas.**

1. En **Los más morosos**, los chips de meses no distinguen el año (mismo
   problema que ya se corrigió en Cartera).
2. Al hacer clic en esos meses (y en `+n`) debería redirigir a `/pagos` en la
   pestaña **Cartera**.
3. La **dona de Estado de pago** está plana: se pide hover con un ligero
   «lift» + brillo de la sección, y clic sobre cada sector que lleve a
   `/afiliados` con el filtro `ESTADO DE PAGO` correspondiente (`Al día`,
   `Por vencer`, `En mora`).

**Causa raíz.**

1. `src/components/dashboard/lista-morosos.tsx` ya usa `etiquetaMesChip` (que
   tras la tanda anterior muestra año), pero verificar el resultado y el `+n`.
2. Los chips son `<span>` sin enlace; no existe navegación a Cartera. La URL de
   `/pagos` no hoy tiene soporte de pestaña en query (decisión 31: los filtros
   no viven en la URL) → decidir mecanismo: query `?tab=cartera` leído por
   `pagos.tsx` al montar, o `sessionStorage`.
3. `src/components/dashboard/grafico-estados.tsx` usa un `<Pie>` estático
   (`isAnimationActive={false}`, sin `activeShape`/`onClick`).

**Corrección.**

1. Confirmar chips con año (`nov 2025`) en lista-morosos; el `+n` hereda el
   mismo estilo.
2. Envolver chips y `+n` en `<a href="/pagos?tab=cartera…">`; en `pagos.tsx`
   leer `tab` al montar para abrir Cartera (decisión a anotar en §7 del Spec
   del cliente: es la primera vez que un query param controla UI, por eso
   Cambio de criterio frente a la decisión 31).
3. Dona: `activeShape`/`activeIndex` con `transform` de traslación y `fill`
   con brillo (`filter: brightness(1.08)`) vía `style`, sin romper los tokens
   CSS (§2.2: `var()` en SVG solo vía `style`); `onClick` por sector →
   `window.location.assign('/afiliados?estado=…')`. Mantener leyenda con color
   + texto + cantidad (accesibilidad).

**Archivos.** `src/components/dashboard/lista-morosos.tsx`,
`src/components/dashboard/grafico-estados.tsx`,
`src/components/pagos/pagos.tsx`, `src/lib/dashboard-datos.ts`.

**Tests.** Unitario para `etiquetaMesChip`/cualquier helper nuevo en
`tests/unit/dashboard-datos.test.ts`.

**Terminado cuando.** Chips con año, clic → Cartera, dona con hover y clic →
`/afiliados?estado=…`.

**Verificación manual (usuario).** Dashboard → morosos muestran año en los
chips; clic en chip o en `+n` abre `/pagos` en Cartera; hover en la dona
levanta/brilla la sección y el clic lleva a Afiliados filtrado.

---

## Unidad 5 — `/pagos` Cartera (botón) y toggle de tema en `/login`

**Síntomas.**

1. En `/pagos` → Cartera, el botón «Registrar pago» de la fila de un nadador
   parte el texto en dos líneas («Registrar / pago») y el botón no se adapta;
   con zoom-out el texto entra.
2. `/login` no tiene botón para cambiar claro/oscuro (o `Sistema`, según el
   device).

**Causa raíz.**

1. `src/components/pagos/tab-cartera.tsx` construye el `<a>` con
   `inline-flex h-8 items-center gap-1 px-2.5` pero **sin `whitespace-nowrap`**;
   la celda de la tabla es angosta y parte el texto. El ancho fijo de la celda
   + `h-8` impiden que el botón crezca.
2. `src/components/layout/selector-tema.tsx` existe y funciona, pero
   `src/pages/login.astro` no lo monta.

**Corrección.**

1. Añadir `whitespace-nowrap` al enlace y, si hace falta, `shrink-0` en la
   celda; revisar que el `h-8` y el padding sigan cómodos al zoom 200%.
2. Montar `<SelectorTema compacto />` en `login.astro` (`client:load`),
   preferiblemente en la esquina superior derecha del layout de auth.

**Archivos.** `src/components/pagos/tab-cartera.tsx`,
`src/pages/login.astro`.

**Tests.** Sin lógica pura nueva; verificación a mano.

**Terminado cuando.** El botón no parte el texto y `/login` alterna el tema.

**Verificación manual (usuario).** `/pagos` → Cartera → el botón de fila cabe
en una línea (probar zoom); `/login` → alternar Claro/Oscuro/Sistema y que
persista al entrar a la app.

---

## Unidad 6 — Plan desactivado sigue en el formulario de afiliados

**Síntoma.** Un plan desactivado desde `/admin` (baja lógica, `activo=false`)
sigue apareciendo en el `<select>` de **Plan** del formulario de alta/edición de
afiliados.

**Causa raíz.** `src/components/afiliados/afiliados.tsx` pasa
`planes.data?.datos ?? []` sin filtrar; `form-afiliado.tsx` itera `planes`
enteros. La API devuelve todos los planes de la organización (activos y no).

**Corrección.** Filtrar por `activo` al consumir el listado en la isla (no en
el formulario, para no romper la edición de un afiliado que aún tenga un plan
desactivado: en edición el plan actual debe seguir mostrándose aunque esté
desactivado, marcado como «(desactivado)»). Mismo criterio para **categorías**
si aplica.

**Archivos.** `src/components/afiliados/afiliados.tsx`,
`src/components/afiliados/form-afiliado.tsx`.

**Tests.** Unitario para la función de filtrado/etiquetado si se extrae a
`src/lib/afiliados-datos.ts`.

**Terminado cuando.** Alta: no aparecen planes/categorías desactivados.
Edición: el plan actual se ve aunque esté desactivado, con aviso.

**Verificación manual (usuario).** Desactivar un plan en `/admin` → ir a
`/afiliados` → «Nuevo afiliado» → el plan no está en el select; editar un
afiliado que lo tenga → se ve marcado como desactivado.

---

## Ajustes del checklist de cierre (2 nov 2026) — reportados por el usuario

El usuario revisó el checklist manual y pidió ajustes en 4 puntos. Los corregí
en el mismo día:

1. **Dashboard → Los más morosos: estilo del enlace.** Los chips (y el `+n`) ahora
   usan `shrink-0 text-sm font-semibold tabular-nums` (antes `text-[11px]
   font-medium` y sin `shrink-0`), igual que el importe que ya tenía ese peso.
2. **Dashboard → Dona Estado de pago: hover.** Se mantiene el brillo
   (`brightness(1.08)`) y se añade un crecimiento de área `scale(1.05)` desde el
   centro del sector (`transformBox: fill-box`); **se retira el lift**
   (`translateY(-4px)`) que reubicaba el sector y hacía que uno en la parte
   inferior "pegara" contra la sección superior.
3. **Afiliados → Panel de detalle → Historial.** Valor pagado y fecha con hora
   quedan en la misma fila (`flex flex-wrap items-baseline gap-x-3 gap-y-1`);
   antes se apilaban.
4. **Admin → Planes: orden.** Nuevo helper puro `ordenaPlanes` (`src/lib/admin-
   datos.ts`): activos primero, inactivos después, orden estable dentro de cada
   grupo. Se aplica al listado de `TabPlanes`.
5. **Dashboard → Dona Estado de pago: detalle extra al hover.** Se añadió una
   línea de detalle vivo (`detalle` derivado de `activo`): «Al día: 3 afiliados
   activos (25%)» — cantidad + porcentaje del estado bajo el cursor.

### Re-ejecución de gates (cierre ampliado)

- `pnpm typecheck` ✅ · `pnpm test` ✅ **164 unit** · `pnpm test:integracion` ✅ **34**
- `pnpm build` ✅ · Smoke `:4399` ✅ (rutas `/`, `/afiliados`, `/pagos`,
  `/pagos?tab=cartera`, `/admin` → 200 con sesión; el proceso se mató).

## Gates de cierre de la ronda

Al terminar las 6 unidades, en este orden. **Resultado de la ronda (28 oct
2026): todos en verde.**

1. ✅ `pnpm api:types` — regenerado tras la Unidad 1 y tras la Unidad 2
   (nuevo `GET /api/v1/afiliados/{id}/pagos` y `meses_adeudados`).
2. ✅ `pnpm typecheck` — sin errores.
3. ✅ `pnpm test` — **162 unit** (antes 141).
4. ✅ `pnpm test:integracion` — **34 integración** (antes 26), DB `:5433` con seed.
5. ✅ `pnpm build` — `dist/` completo.
6. ✅ Smoke `PORT=4399 node --env-file-if-exists=.env dist/server/entry.mjs`:
   `/login` 200 (con selector de tema), `/`, `/afiliados`, `/pagos`,
   `/pagos?tab=cartera`, `/pagos/nuevo`, `/admin` 200 con sesión; el proceso se
   mató después (no se tocó el `pnpm dev:api` en `:3000`).

## Documentación de cierre

- Anotar las decisiones nuevas en `Specs/Spec del cliente.md` §7 (número 53 en
  adelante), especialmente: preprocess de `activo`, mantenimiento de encabezados
  en el vacío, y el primer `query param` de UI (`?tab=`) frente a la decisión 31.
- Actualizar `AGENTS.md` con cualquier invariante nuevo (p. ej. «`activo` en el
  query se parsea con preprocess, no `z.coerce.boolean()`») y los conteos de
  tests.
- Reportar al usuario el checklist manual por unidad.
