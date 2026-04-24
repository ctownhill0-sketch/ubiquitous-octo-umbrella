; LeadStack™ Windows Installer Script (NSIS)
; Creates a professional Windows installer with Start Menu shortcuts

!define APP_NAME "LeadStack"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "LeadStack"
!define APP_URL "http://localhost:7432"
!define APP_EXE "LeadStack.exe"
!define INSTALL_DIR "$PROGRAMFILES64\LeadStack"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "dist\LeadStack-Setup.exe"
InstallDir "${INSTALL_DIR}"
InstallDirRegKey HKLM "Software\LeadStack" "Install_Dir"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

; ─── Pages ────────────────────────────────────────────────────────────────────
!include "MUI2.nsh"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; ─── Install ──────────────────────────────────────────────────────────────────
Section "LeadStack (required)" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "dist\${APP_EXE}"

  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\LeadStack"
  CreateShortcut "$SMPROGRAMS\LeadStack\LeadStack.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$DESKTOP\LeadStack.lnk" "$INSTDIR\${APP_EXE}"

  ; Write registry keys for uninstaller
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeadStack" \
    "DisplayName" "LeadStack"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeadStack" \
    "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeadStack" \
    "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeadStack" \
    "Publisher" "${APP_PUBLISHER}"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeadStack" \
    "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeadStack" \
    "NoRepair" 1

  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

; ─── Uninstall ────────────────────────────────────────────────────────────────
Section "Uninstall"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\LeadStack\LeadStack.lnk"
  RMDir "$SMPROGRAMS\LeadStack"
  Delete "$DESKTOP\LeadStack.lnk"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\LeadStack"
SectionEnd
