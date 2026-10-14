**Truchas** es una corporación de natación local, el cual se integrará a Membrio como el primer cliente

Formularios Truchas: 
Truchas cuenta con varios formularios de google forms los cuales se conectan con las bases de datos basadas en google sheets para toda su gestión de Clientes y Pagos. 

Los dos forumarios principales que vamos usar para diseñar los primeros módulos de ´Spec.md´, son el **Formulario de Inscripción** y el 

**Formulario de Pago de Mensualidad**
La ides es:
    - El **Formulario de Inscripción** vaya alimentando la base de datos de **Afiliados**
    - El **Formulario de Pago de Mensualidad** va a alimentar la base de datos de **Estado de Pago**

**Atributos de Formulario de Inscripción**:

- Tipo de documento del nadador: {Lista desplegable con las opciones}= 
    - Tarjeta de identidad
    - Cédula de ciudadanía
    - Registro Civil
    - Pasaporte
    - PPT
- Número de documento del nadador (sin puntos ni espacios) {Tiene su validación o al menos un flag que indica '¡sólo números!', por entrada deja ingresar lo que sea, no confirmo si el sumit permite cualquier valor}
- Nombre completo del nadador {cadena de texto}
- Número de celular (si es menor de edad poner el del acudiente responsable).  Se usará para la factura electrónica. {Lo mismoq ue numero de documento}
- Correo electrónico  (si es menor de edad poner el del acudiente responsable). Se usará para la factura electrónica. {cadena de texto}
- Nombre de la EPS del nadador (SURA, NUEVA EPS, SANITAS,ETC) * (A pesar de parecer ser otra lista) {cadena de texto}
- Tipo de sangre del nadador {cadena de texto}
- Fecha de nacimiento del nadador {tipo fecha mm/dd/aaaa}
- Cedula del acudiente responsable y persona a quién se le realizará la factura electrónica {cadena de texto}
- Nombre completo del acudiente responsable y persona a quién se le realizará la factura electrónica {cadena de texto}
- Dirección de residencia {cadena de texto}
- ¿Por qué medio se enteró de Truchas? {Lista desplegable con las opciones}=
    - Facebook
    - Instagram
    - TikTok
    - Busqeuda en Google
    - Referidos (amigos, conocidos, familiares, etc)
    - Publicidad en la calle (volantes, publicada en centros comerciales, etc)
- Firmar y confirmar por WhatsApp antes del primer día de clase (SIN LA APROBACIÓN DE ESTOS 2 DOCUMENTOS NO ES POSIBLE LA ACEPTACIÓN EN LA CORPORACIÓN TRUCHAS DE NATACIÓN) {radius boton, supongo valor binario de tipo true/false o 0/1}
- Cargar en PDF o foto del documento de identidad del nadador, del contrato firmado y consentimiento informado {Doc de máximo 100 MB}
- ¿Cuál plan escogió? {2 radius boton, solo aplica una respuesta}
    - Plan básico
    - Plan Pro
- Curso a inscribir {radius boton, solo aplica una respuesta}
    - Equipo competitivo
    - Semillero de iniciación
    - Semillero avanzado A
    -Semillero avanzado B
    - Iniciación 2 para niños
    - Iniciación 1A para niños
    - Iniciación 1B para niños
    - Equipo máster
    - Semillero Máster
    - Iniciación adultos


**Estructura Hoja de Calculo Base de Datos**
La hoja de calculo contiene las siguiente columnas: 
    - Tipo documento	
    - CC / T.I
    - Nombre completo
    - Estado
    - Plan
    - Categoria 2026
    - Estado de mensualidad
    - Celular
    - Correo
    - EPS
    - Tipo de sangre
    - Fecha de nacimiento
    - Activación Poliza 2026
    - Estado poliza
    - Edad
    - Rango de edad
    - Género
    - Descuentos
    - Valor Mensualidad
    - Costo matricula
    - Sede 1
    - Día 1
    - Hora 1
    - Sede 2 
    - Día 2
    - Hora 2
    - Sede 3
    - Día 3
    - Hora 3
    - Sede 4
    - Día 4
    - Hora 4
    - Sede 5
    - Día 5
    - Hora 5
    - Sede 6
    - Día 6
    - Hora 6
    - Cedula del acuciente para factura electrónica
    - Encargado
    - Dirección
    - Carta responsabilidad
    - Poliza
    - Fecha ingreso
    - Mes ingreso
    - Año ingreso
    - Fecha retiro
    - Mes retiro
    - Año retiro
    - Motivo del retiro
    - Cómo se enteró de Truchas?
    - Mes nacimiento
    - Día nacimiento

**Formulario de pago de mensualidad**
    - Número de documento del nadador(a) (Sin comas, ni espacios. Ejemplo: 448265286) {Por input deja colocar texto pero sale un flag indicanfo ´¡sólo números!´}
    - Nombre completo del nadador(a) (Ejemplo: Juelieta Castaño Perez) * {cadena de texto}
    - Número de cédula del responsable del pago para la factura electrónica: * {Por input deja colocar texto pero sale un flag indicanfo ´Must be a whole number´}
    - Nombre del responsable del pago:(Tenga en cuenta que la factura electrónica será emitida a nombre de la persona que realizó este pago) {Cadena de tipo texto}
    - Fecha de pago: Corresponde al mes para el cual está pagando la mensualidad. * {Lista desplguegable con las opciones de Febrero a Diciembre}
    - Pago de matrícula (sólo se paga una vez en el año, si ya la pagó, ponga 0) * {2 boton raduis con las opciones - 74000 - 0}
    - ¿Alguna observación? (Si está atrasado en algún mes, puede realizar el pago de esos meses junto con el actual. Por favor, especifique aquí cuáles meses está pagando, si realiza varios pagos, especifique nombre y cedula de los nadadores a pagar) {Cadena de Texto}
    - Adjuntar pantallazo del comprobante: * {Archivo de Max 100 MB}

**Hoja de calculo Mensualidad**
La hoja de calculo contiene las siguiente columnas: 
    - Documento	Nadador
    - Estado
    - Fecha retiro
    - Observaciones
    - Plan
    - Categoria 2026
    - Mensualidad	Matricula
    - Cedula factura
    - Nombre factura
    - Telefono
    - Correo
    - Dirección
    - 1/02/2024
    - 1/03/2024
    - 1/04/2024
    - 1/05/2024
    - 1/06/2024
    - 1/07/2024
    - 1/08/2024
    - 1/09/2024
    - 1/10/2024
    - 1/11/2024
    - 1/12/2024
    - 1/01/2025
    - 1/02/2025
    - 1/03/2025
    - 1/04/2025
    - 1/05/2025
    - 1/06/2025
    - 1/07/2025
    - 1/08/2025
    - 1/09/2025
    - 1/10/2025
    - 1/11/2025
    - 1/12/2025
    - 1/02/2026
    - 1/03/2026
    - 1/04/2026
    - 1/05/2026
    - 1/06/2026
    - 1/07/2026
    - 1/08/2026
    - 1/09/2026
    - 1/10/2026
    - 1/11/2026
    - 1/12/2026