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
