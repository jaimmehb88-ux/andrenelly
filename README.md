# SATH Escritorio 2.0

Aplicación local para Windows 10/11 de 64 bits: formularios SATH, autocompletado configurable y **Escaneos Pro**. No necesita Internet después de instalarla. Los documentos, ajustes e imágenes se guardan en el equipo, sin imágenes Base64 ni servicios externos.

## Descargar y actualizar

En [GitHub Releases](https://github.com/jaimmehb88-ux/andrenelly/releases) descarga `SATH-Escritorio-2.0.0-Instalador.exe`. Cierra SATH antes de instalar y conserva la misma carpeta de la versión anterior. La ubicación por usuario propuesta permite guardar datos sin permisos de administrador; evita `Program Files` u otras carpetas protegidas.

La aplicación conserva su identidad y la carpeta `datos`. En el primer inicio con datos v1, crea un respaldo completo en `datos/respaldos/migraciones` **antes** de actualizar el formato. Si ese respaldo falla, no migra ni sobrescribe el archivo anterior. Los documentos y las plantillas existentes se conservan. Las versiones anteriores siguen disponibles en Releases.

El instalador no tiene firma digital de editor. Las pruebas automatizadas de Windows comprueban la aplicación y el ejecutable empaquetado; la instalación, actualización, desinstalación y la impresión física deben verificarse también en un equipo Windows con impresora real. Antes de actualizar, conserva un respaldo externo.

## Datos del formulario

Crea un documento, elige una plantilla y completa sus campos. El guardado es automático y la vista previa A4 se actualiza mientras escribes. Los campos vinculados siguen copiando sus valores automáticamente. Los datos se organizan en trámite, persona y fecha del documento.

- **Autocompletado**: activa/desactiva las sugerencias globalmente y por campo. En la configuración puedes crear, editar y eliminar sugerencias manuales, una por línea. También puedes guardar explícitamente el valor de un campo como sugerencia desde su botón.
- **Historial**: viene desactivado. Solo si habilitas la opción se consultan documentos anteriores para sugerir valores o buscar por DNI. No se crea una agenda oculta de personas: desactivar la opción deja de consultar el historial.
- **Buscar por DNI**: escribe ocho dígitos, habilita el historial y revisa el documento de origen y los valores propuestos. Puedes cancelar sin cambiar nada. Solo se recuperan nombre, DNI, dirección y contacto; no se reemplazan fechas ni datos del trámite.
- **Teclado**: Tab avanza, Mayús + Tab retrocede. Las sugerencias usan el selector del sistema. Enter avanza en campos sin sugerencias. Los mensajes indican cómo corregir DNI y correo.
- **Salida**: PDF, PNG y JPG o impresión con/sin fondo. **Editar en Escaneos Pro** crea un proyecto independiente a partir del documento para añadir imágenes o textos sin modificar el original.

Atajos generales: Ctrl+N para un documento nuevo y Ctrl+S para guardar ahora. El cierre normal espera al guardado. Si no se puede guardar, la ventana permanece abierta y permite reintentar.

## Escaneos Pro: carpeta vigilada

1. Pulsa **Seleccionar carpeta** y elige dónde se guardan tus escaneos. La aplicación recuerda la ruta al reiniciar.
2. La galería muestra las **seis imágenes más recientes por fecha de modificación**, de mayor a menor, con nombre y fecha. Se actualiza automáticamente al agregar, modificar o borrar archivos. También existe **Actualizar**.
3. **Ver toda la carpeta** permite buscar por nombre, seleccionar imágenes de cualquier fecha o abrirlas en el editor.
4. Se admiten JPG, JPEG, PNG y WEBP estáticos, hasta 30 MB y 50 megapíxeles por imagen. Las subcarpetas y los enlaces simbólicos no se recorren. Se informa de formatos omitidos y archivos dañados.
5. Los archivos nuevos se muestran cuando su tamaño y fecha se estabilizan y se pueden decodificar completos. Si la carpeta se desconecta, la aplicación sigue funcionando y vuelve a comprobarla. Cambiar de carpeta descarta resultados tardíos de la ruta anterior.

La galería consulta la carpeta original, pero al editar una imagen se guarda una copia independiente en `datos/imagenes`. Los originales no se editan, renombran ni eliminan.

## Editor por capas

Abre una imagen de la galería o crea un proyecto. Puedes seleccionar un proyecto guardado para continuar más tarde. El proyecto y sus ajustes se conservan al cerrar el programa.

- **Página**: A4 vertical u horizontal, zoom de ajuste/50–200 % y herramienta de desplazamiento. Cambiar la orientación conserva las posiciones; revisa las capas y ajusta su ubicación si es necesario.
- **Posición y tamaño**: selecciona una capa en la lista o sobre la hoja. Arrástrala o escribe sus coordenadas y medidas en píxeles de la composición A4 (794 × 1123 en vertical). Las flechas mueven 1 px y Mayús + flechas 10 px.
- **Imagen**: rotación ±90° o enderezado con décimas de grado; brillo, contraste, escala de grises y opacidad. **Recortar imagen** permite arrastrar el área que quieres conservar sobre el original. El recorte es reversible. **Restablecer ajustes** recupera color, opacidad, rotación y recorte completo.
- **Texto**: contenido multilínea, fuente, tamaño, color, grosor, alineación y espaciado. Se puede mover, cambiar de tamaño y rotar como las imágenes.
- **Capas**: insertar más imágenes, seleccionar, subir/bajar, ocultar, bloquear/desbloquear y eliminar con confirmación. La primera capa de la lista está encima. El bloqueo impide cambiar medidas o posición, pero permite decidir si se incluye en la salida.
- **Deshacer/Rehacer**: botones y Ctrl+Z / Ctrl+Mayús+Z o Ctrl+Y, fuera de los campos de texto. Se conservan hasta 50 operaciones recientes del proyecto activo, limitadas por memoria. El historial de deshacer se reinicia al cambiar de proyecto o reiniciar la aplicación; la edición actual sí se guarda.

**Cargar plantilla o documento** crea un proyecto independiente con el fondo y cada campo como capas. Los valores de un documento se copian tal como están al cargarlo; los cambios posteriores en el documento no alteran automáticamente este proyecto. Puedes editar el contenido de sus campos como texto y superponer nuevas imágenes.

## Impresión y exportación

**Lo que está visible en el editor es lo que se exporta e imprime.** Usa las casillas del fondo, de los campos y de cada capa para incluir o excluir elementos. Para papel preimpreso, oculta el fondo y conserva los campos e imágenes necesarios.

- **PDF**: una página A4 para el proyecto. Los textos se conservan como texto vectorial.
- **PNG/JPG**: página A4 con fondo blanco, a 96, 150 o 300 ppp. En vertical son 794 × 1123, 1240 × 1754 o 2480 × 3508 píxeles. La composición es la misma que en la vista previa; se captura a resolución nativa por partes para evitar límites de tamaño de las pantallas.
- **Imprimir**: diálogo del sistema. Selecciona A4 y escala real/100 % para alinear sobre formularios físicos. Los márgenes reales dependen de la impresora.
- **Lotes**: selecciona hasta 100 imágenes de la galería/explorador, pulsa **PDF / imprimir selección**, ajusta el orden y la orientación. Cada original se ajusta proporcionalmente a una página A4. Para exportar ediciones, abre su proyecto y usa la salida del editor; el lote de la galería utiliza los originales seleccionados.

Las exportaciones solicitan una ubicación y **no sobrescriben archivos existentes**, incluso si el diálogo del sistema permite escoger uno. Elige un nombre nuevo. De este modo se protegen originales y exportaciones anteriores. Los archivos PDF/PNG/JPG son salidas finales; los proyectos editables están en el archivo de datos y los respaldos.

## Datos y respaldos

```text
SATH Escritorio/
  SATH Escritorio.exe
  datos/
    documentos.json       # documentos, plantillas, proyectos y preferencias v2
    documentos.json.bak   # versión anterior del archivo
    imagenes/             # JPG, PNG y WEBP como archivos normales
    respaldos/
      migraciones/        # copia completa previa a migrar v1
```

**Crear respaldo completo** incluye documentos, plantillas, sugerencias, preferencias, proyectos y todas las imágenes referenciadas por sus capas, incluso ocultas. Para restaurar, selecciona `documentos.json` del respaldo con su carpeta `imagenes` al lado. La restauración crea primero un respaldo completo de los datos actuales, valida las imágenes y utiliza nombres nuevos para no sustituir las existentes. Admite respaldos v1 y v2.

La configuración recuerda la ruta de escaneos, pero el respaldo **no copia toda esa carpeta externa**: solo las imágenes importadas por documentos/proyectos. La galería se vuelve a leer desde la ruta configurada. En otro equipo puedes elegir una nueva carpeta si la original no está disponible.

El instalador y el desinstalador conservan `datos`. No muevas ni borres esa carpeta durante el uso. Guarda copias externas: la copia automática protege frente a un archivo dañado, pero no frente a pérdida del equipo. Los respaldos contienen datos personales y no están cifrados. El control de acceso depende de la cuenta de Windows; no hay usuarios internos ni sincronización.

Límites: 2000 documentos, 100 plantillas, 200 campos por plantilla, 500 proyectos, 250 capas por proyecto, 100 sugerencias por campo y 40 MB de datos JSON y 150 megapíxeles de imágenes visibles por proyecto (sin contar repetidas). Los archivos de imagen se guardan aparte. La carpeta vigilada admite hasta 10 000 elementos.

## Desarrollo y comprobaciones

Requiere Node.js 24 y npm. Usa el checkout existente; las tareas de nube ya están aisladas y no requieren otro worktree.

```sh
npm ci
npx install-electron
npm test
npm start
```

Electron 45 instala su runtime mediante `install-electron`. Sharp 0.35.5 se usa para decodificar imágenes completas, comprobar límites y ensamblar exportaciones; sus binarios nativos se incluyen en el paquete de Windows. Versiones e integridades están fijadas en `package-lock.json`.

- `npm test`: almacenamiento, migración v1 con respaldo y fallos seguros, sugerencias/historial/DNI, composición A4, capas, respaldo/restauración con WEBP, vigilancia, orden, archivos incompletos y cambios de carpeta durante lecturas pendientes.
- `npm run test:ui`: regresión de documentos, plantillas, PDF y datos de la versión anterior usando Electron real.
- `npm run test:ui:v2`: recorrido funcional completo de migración, autocompletado, confirmación por DNI, galería, edición, recorte, filtros, capas, PNG/JPG/PDF, 300 ppp, protección de originales, lotes, respaldo/restauración y reinicio. Genera capturas y archivos en `.test-output-v2/`, sin utilizar datos personales del desarrollo.
- `npm run test:packaged`: después de compilar en Windows, abre el ejecutable empaquetado y comprueba migración, conservación de datos, carga del módulo nativo, WEBP y exportación PNG. Usa una carpeta `datos` nueva en `dist/win-unpacked`, y la elimina al terminar; se niega a sobrescribir una carpeta de datos existente.

Para desarrollar en este contenedor Linux:

```sh
export SATH_DATA_DIR="$PWD/.runtime/datos"
export XDG_CACHE_HOME="$PWD/.runtime/cache"
export npm_config_cache=/tmp/sath-npm-cache
export NODE_USE_ENV_PROXY=1
export electron_config_cache="$PWD/.runtime/cache/electron"
npm ci
node node_modules/electron/install.js
./scripts/cloud-display.sh
export DISPLAY=:99
npm start -- --no-sandbox
```

El contenedor no permite el sandbox interno de Chromium; la excepción `--no-sandbox` se limita al desarrollo dentro del aislamiento externo y a la automatización. No se incorpora al código ni al instalador de Windows. En desarrollo `SATH_DATA_DIR` cambia la carpeta de datos; el ejecutable instalado siempre usa `datos` junto al programa. Los procesos gráficos deben reiniciarse en cada tarea nueva. No hay servidor web ni vistas localhost.

Para compilar el instalador:

```sh
npm run dist:win
```

El script NSIS genera instalador y desinstalador sin ejecutar binarios Windows en Linux. El workflow de GitHub Actions ejecuta las comprobaciones en Windows, compila y comprueba el ejecutable empaquetado. En etiquetas `v*` publica el instalador en Releases; en `main` y ejecuciones manuales guarda un artefacto. La compilación desactiva la publicación implícita de electron-builder y utiliza exclusivamente la publicación explícita del workflow.

## Estructura

`src/store.cjs` gestiona datos, migración y respaldos; `assets.cjs` valida e importa imágenes; `scanner.cjs` vigila carpetas; `scene.js` es la composición compartida de vista previa/salida; `output.cjs` exporta e imprime; `completion.js` resuelve sugerencias y datos personales; `autocomplete.js` y `scans.js` implementan sus interfaces. Se conservan los módulos de documentos y plantillas de la versión anterior.

La ventana mantiene aislamiento de contexto, Node.js desactivado y operaciones IPC específicas. Los protocolos de imagen validan nombres o identificadores de archivos elegidos desde la carpeta configurada. Los textos se escapan antes de componer la salida. No se ejecuta código generado por el usuario ni se incrustan credenciales.
