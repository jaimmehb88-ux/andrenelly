# Andrenelly · Formularios SATH 3.0.0

Descarga **SATH-Escritorio-3.0.0-Instalador.exe** en Assets / Recursos. Windows 10/11 de 64 bits.

- Identidad azul marino, verde y celeste, con los logos originales de Bazar Superclean Andrenelly y SATH sin recortar ni deformar.
- Bienvenida animada omisible, transición suave y respeto por la preferencia de reducir movimiento. SATH se identifica como entidad pública; no se afirma un convenio ni un desarrollo oficial.
- Escaneos Pro: ocho tiradores de tamaño con dimensiones en vivo, proporción conservada desde las esquinas y opción expresa de ajuste libre. Compatible con zoom, rotación, bloqueo, deshacer/rehacer y guardado automático. Los originales permanecen intactos.
- Modo desarrollador con contraseña inicial `user2`, verificada con scrypt y sal aleatoria en el proceso principal. Cambio de contraseña y cierre de sesión. La sesión no persiste tras reiniciar.
- Pro desactivado inicialmente. Escaneos Pro y Nueva plantilla se abren desde el panel de desarrollador. Activar Pro los habilita en la pantalla principal para todos los usuarios de esa instalación; desactivarlo los restringe sin borrar proyectos ni plantillas.
- Autorización interna para proyectos, creación de plantillas y operaciones del editor; la configuración Pro se almacena separadamente de los documentos.

## Actualización desde 2.0.0

Cierra la aplicación y selecciona la misma carpeta de instalación. Se conserva el ejecutable compatible `SATH Escritorio.exe`, la identidad de instalación y la carpeta `datos`. El nombre visible cambia a **Andrenelly · Formularios SATH**.

En el primer inicio se crea `datos/respaldos/antes-de-3.0.0-*`, con documentos, plantillas, proyectos, preferencias e imágenes, incluidas las no referenciadas. Se mantiene el formato de datos v2 y no se borran archivos. La caché temporal de Chromium queda excluida. Si falla el respaldo, se detiene el inicio sin actualizar la configuración de acceso. Las versiones anteriores de GitHub Releases se conservan.

## Verificación

La publicación requiere pasar las pruebas unitarias, la interfaz v2/v3, el ejecutable empaquetado y una instalación real de 2.0.0 seguida de actualización, reinstalación y desinstalación de 3.0.0, conservando los datos y las imágenes por SHA-256.

Se prueban contraseñas correctas/incorrectas, cambio, cierre, reinicio, Pro persistente, operaciones internas denegadas, mouse con zoom 50/100/200 %, giros 0/35/90°, bloqueo, proporción libre y fija, deshacer/rehacer y autoguardado. Las exportaciones PNG/JPG/PDF también se verifican.

Pendiente de comprobación manual: impresión en una impresora física y prueba en otros equipos/configuraciones de Windows. El instalador no tiene firma digital de editor. `SHA256SUMS.txt` permite comprobar la integridad de la descarga.
