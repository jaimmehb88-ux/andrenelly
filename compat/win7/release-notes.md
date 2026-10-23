Aplicación SATH **3.0.0**, edición para Windows 7 SP1:

- **Win7-x64-Instalador.exe**: Windows de 64 bits.
- **Win7-ia32-Instalador.exe**: Windows de 32 bits (también funciona en 64 bits).
- **SHA256SUMS.txt**: integridad de ambas descargas.

Incluye Electron 22.3.27 y Sharp 0.32.6, con las adaptaciones de protocolos de imágenes y clonación para el runtime antiguo. Conserva la carpeta `datos` al reinstalar y desinstalar. Haz un respaldo externo antes de actualizar y cierra la aplicación antes de ejecutar el instalador. Usa una carpeta distinta si quieres conservar también una instalación moderna.

Cada arquitectura se comprueba automáticamente en Windows Server 2022: pruebas de datos y acceso, interfaz, importación WEBP, exportación PNG del ejecutable empaquetado, arquitectura PE, instalación, reinstalación y desinstalación conservando datos. No se ha probado en un equipo real con Windows 7 ni con una impresora física. El instalador no tiene firma digital de editor.

Windows 7 y este runtime antiguo ya no reciben mantenimiento de seguridad. Esta edición es para uso local en equipos heredados; la edición moderna para Windows 10/11 se conserva en su release original.
