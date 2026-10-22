; Native NSIS script: builds installer + uninstaller without executing Windows
; binaries on the build machine. Both use the same data-preserving cleanup.
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
!define APP_EXECUTABLE_FILENAME "SATH Escritorio.exe"
!define UNINSTALL_FILENAME "Desinstalar SATH Escritorio.exe"
!define SATH_REG "Software\Andrenelly\SATH"
!define SATH_UNINSTALL "Software\Microsoft\Windows\CurrentVersion\Uninstall\SATH-Escritorio"

Name "${PRODUCT_NAME}"
BrandingText "${PRODUCT_NAME} ${VERSION}"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
InstallDirRegKey HKCU "${SATH_REG}" "InstallDir"
SetCompressor zlib
SetCompress auto
SetDatablockOptimize on
ShowInstDetails show
ShowUninstDetails show
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bienvenido a Andrenelly · Formularios SATH"
!define MUI_WELCOMEPAGE_TEXT "Instala tus formularios y plantillas A4 en este equipo.$\r$\n$\r$\nLos documentos e imágenes se guardarán en la carpeta datos, junto al programa. Selecciona una carpeta que tu usuario pueda modificar.$\r$\n$\r$\nCierra SATH antes de continuar."
!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE CheckDirectory
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!insertmacro MUI_PAGE_FINISH
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Se quitará el programa. La carpeta datos se conservará con tus documentos e imágenes. Antes de continuar, crea un respaldo externo desde la aplicación."
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SpanishInternational"

Function .onInit
  SetShellVarContext current
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "SATH Escritorio necesita Windows de 64 bits."
    Abort
  ${EndIf}
  SetRegView 64
  FindWindow $0 "" "SATH Escritorio"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Cierra SATH Escritorio antes de continuar."
    Abort
  ${EndIf}
  FindWindow $0 "" "${PRODUCT_NAME}"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Cierra SATH Escritorio antes de instalar o actualizar."
    Abort
  ${EndIf}
FunctionEnd

Function CheckDirectory
  ${GetRoot} "$INSTDIR" $0
  ${If} "$INSTDIR" == "$0\"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Selecciona una carpeta para el programa, no la raíz de una unidad."
    Abort
  ${EndIf}
  CreateDirectory "$INSTDIR"
  ClearErrors
  FileOpen $0 "$INSTDIR\.sath-permisos.tmp" w
  ${If} ${Errors}
    MessageBox MB_OK|MB_ICONSTOP "No tienes permiso para guardar en esta carpeta. Elige una carpeta de tu usuario."
    Abort
  ${EndIf}
  FileClose $0
  Delete "$INSTDIR\.sath-permisos.tmp"
FunctionEnd

Section "SATH Escritorio" SEC_MAIN
  SetRegView 64
  Call CheckDirectory
  SetOutPath "$INSTDIR"
  ; File instructions retain NSIS error handling and the built-in data checks.
  !ifdef NSIS_WIN32_MAKENSIS
    File /r "${PROJECT_DIR}\dist\win-unpacked\*.*"
  !else
    File /r "${PROJECT_DIR}/dist/win-unpacked/*.*"
  !endif
  WriteUninstaller "$INSTDIR\${UNINSTALL_FILENAME}"
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCU "${SATH_REG}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${SATH_UNINSTALL}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${SATH_UNINSTALL}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${SATH_UNINSTALL}" "Publisher" "Andrenelly"
  WriteRegStr HKCU "${SATH_UNINSTALL}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${SATH_UNINSTALL}" "DisplayIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCU "${SATH_UNINSTALL}" "UninstallString" '$\"$INSTDIR\${UNINSTALL_FILENAME}$\"'
  WriteRegStr HKCU "${SATH_UNINSTALL}" "QuietUninstallString" '$\"$INSTDIR\${UNINSTALL_FILENAME}$\" /S'
  WriteRegDWORD HKCU "${SATH_UNINSTALL}" "NoModify" 1
  WriteRegDWORD HKCU "${SATH_UNINSTALL}" "NoRepair" 1
SectionEnd

Function un.onInit
  SetShellVarContext current
  SetRegView 64
  FindWindow $0 "" "SATH Escritorio"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Cierra SATH Escritorio antes de continuar."
    Abort
  ${EndIf}
  FindWindow $0 "" "${PRODUCT_NAME}"
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Cierra SATH Escritorio antes de desinstalar."
    Abort
  ${EndIf}
FunctionEnd

Section "Uninstall"
  !insertmacro customRemoveFiles
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  DeleteRegKey HKCU "${SATH_UNINSTALL}"
  DeleteRegKey HKCU "${SATH_REG}"
SectionEnd
