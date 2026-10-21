# SATH Escritorio

Aplicación local para Windows 10/11 de 64 bits. Completa formularios SATH sobre plantillas A4 y guarda documentos, imágenes y respaldos en el equipo. Funciona sin Internet después de instalarla.

## Uso

1. Pulsa **Nuevo documento**, elige la plantilla y asigna un nombre.
2. Completa los datos. La vista previa se actualiza y los cambios se guardan automáticamente.
3. Usa **Guardar PDF** o **Imprimir**. Desactiva **Incluir plantilla de fondo** al imprimir sobre papel preimpreso. En la impresora selecciona A4 y escala real/100 %; el ajuste físico depende de los márgenes de cada impresora.
4. En **Plantillas A4**, añade o duplica plantillas, importa imágenes JPG/PNG y ajusta campos arrastrándolos o introduciendo medidas. Con un campo enfocado, las flechas lo mueven 0,1 % y Mayús + flechas 1 %.
5. En **Datos y respaldos**, crea una copia completa en otra unidad. Para restaurar, selecciona `documentos.json` del respaldo, con su carpeta `imagenes` al lado. La restauración crea primero un respaldo de los datos actuales.

Atajos: **Ctrl+N**, nuevo documento; **Ctrl+S**, guardar ahora. El cierre normal espera a que termine el guardado. Si falla, la ventana permanece abierta para reintentar con Ctrl+S.

La edición de una plantilla afecta a todos sus documentos. Duplica la plantilla antes de preparar un formato diferente. Las imágenes deben ser JPG o PNG, hasta 30 MB y 50 megapíxeles. Límites de esta versión: 100 plantillas, 200 campos por plantilla y 2000 documentos.

## Instalar en Windows

Ejecuta `SATH-Escritorio-1.0.1-Instalador.exe` y conserva preferiblemente la ubicación por usuario propuesta. El instalador permite elegir otra carpeta que tu usuario pueda modificar; evita carpetas protegidas como `Program Files`. No requiere privilegios de administrador. Incluye accesos directos y desinstalador.

Los datos quedan junto a `SATH Escritorio.exe`:

```text
SATH Escritorio/
  SATH Escritorio.exe
  datos/
    documentos.json
    documentos.json.bak
    imagenes/
    respaldos/           # copias previas a una restauración
```

Las imágenes del HTML original se extrajeron como archivos JPG, manteniendo su calidad y las coordenadas de los campos. No se utiliza Base64 ni localStorage para guardar imágenes o documentos. Las nuevas imágenes reciben nombres internos únicos. Se eliminaron las funciones de generar código fuente, descargar el sistema como HTML y generar códigos de imagen, así como las contraseñas incrustadas del prototipo. El acceso a los archivos depende de la cuenta de Windows; esta versión no incorpora usuarios, cifrado ni sincronización.

El instalador actualiza los archivos del programa sin incluir ni reemplazar `datos`; el desinstalador también conserva esa carpeta. Conserva un respaldo externo antes de actualizar o desinstalar. Al reinstalar, elige la misma carpeta para recuperar los datos conservados. Los respaldos incluyen información personal y no están cifrados.

El instalador se genera sin firma digital de editor. La instalación, desinstalación, actualización y la impresión física necesitan una comprobación final en un equipo Windows real. Esta aplicación utiliza las plantillas aportadas; no comprueba la vigencia legal de sus formularios.

## Desarrollo

Requiere Node.js 24 y npm. No necesita servidor, base de datos externa ni claves de acceso. Usa el checkout existente; cada tarea de nube ya está aislada y no necesita otro worktree.

```sh
npm ci
npx install-electron
npm test
npm start
```

Electron 45 descarga su runtime mediante `install-electron`; `npm ci` por sí solo no lo instala. Las versiones exactas y las integridades de los paquetes están en `package-lock.json`.

En Windows, para compilar:

```powershell
npm ci
npx install-electron
npm test
npm run dist:win
```

Resultado: `dist/SATH-Escritorio-1.0.1-Instalador.exe`. El workflow **Compilar instalador de Windows** permite ejecutar la compilación manualmente desde GitHub Actions o al subir una etiqueta `v*`, y guarda el instalador como artefacto. Al subir una etiqueta `v*`, también publica el instalador en GitHub Releases con un enlace de descarga. Las ejecuciones manuales guardan el artefacto sin publicar una versión.

Para ejecutar desde Linux en este entorno de nube:

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

Este contenedor Linux no permite el sandbox interno de Chromium (ni el auxiliar setuid ni los espacios de nombres de usuario), por lo que la ejecución de desarrollo en la nube usa `--no-sandbox` dentro del aislamiento externo. La automatización de Electron también lo usa. Este argumento no se incluye en el código ni en el instalador Windows; allí se utiliza `npm start` o el ejecutable normalmente.

En desarrollo `SATH_DATA_DIR` cambia la carpeta de datos; en el programa empaquetado siempre se usa `datos` junto al ejecutable. Los procesos gráficos deben arrancar de nuevo en una tarea nueva. No se exponen vistas web ni servicios de red.

## Comprobaciones

- `npm test`: almacenamiento real, validación de rutas y límites, recuperación de archivo dañado, respaldo/restauración con imágenes y composición de impresión.
- `npm run test:ui`: prueba de integración con Electron real y pantalla gráfica disponible. Ejercita documentos, campos vinculados, imágenes locales, PDF, duplicación, borrado, arrastre, respaldo, restauración y persistencia después de cerrar y reiniciar. En Linux: `DISPLAY=:99 npm run test:ui` después de iniciar la pantalla. Genera PDF y capturas en `.test-output/`; no escribe documentos de prueba en los datos de uso normal.
- El script NSIS personalizado genera instalador y desinstalador directamente, sin ejecutar binarios Windows en Linux. La ruta automatizada de compilación es Windows. No desactives las verificaciones TLS ni las comprobaciones de integridad de las descargas.

## Estructura

- `src/main.cjs`: ventana, diálogos, IPC restringido, imágenes y PDF/impresión.
- `src/preload.cjs`: interfaz mínima entre la ventana y el proceso principal.
- `src/store.cjs`: datos en JSON, escrituras atómicas, copia automática y respaldos.
- `src/document.cjs`: composición A4 y campos vinculados para impresión.
- `src/renderer.js`, `src/index.html`, `src/styles.css`: interfaz en español, sin dependencias web remotas.
- `assets/`: plantillas originales extraídas, medidas e iconos.
- `build/windows.nsi`, `build/installer.nsh`: instalador por usuario y desinstalación que conserva datos.

La ventana usa aislamiento de contexto, sandbox y Node.js desactivado. Las solicitudes de disco pasan por operaciones específicas; las imágenes usan un protocolo local que valida los nombres. Los valores del formulario se insertan como texto y se escapan al generar el PDF. Las copias externas conservan las imágenes utilizadas por las plantillas, sin incluir cachés del navegador.
