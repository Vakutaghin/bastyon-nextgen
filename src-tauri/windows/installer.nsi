Unicode true
; tauri-cli 2.11.5
; Bastyon NextGen NSIS installer: the tauri-cli 2.11.5 template
; (crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi at tag
; tauri-cli-v2.11.5) with the changes marked "BASTYON:". After a CLI upgrade,
; take its template again and carry the changes over; the test in
; src/helpers/updates/nsis-template.test.ts compares the version on line 2
; with the installed CLI. To build it on macOS: brew install makensis, and
; LANG=en_US.UTF-8 (makensis crashes with bad_alloc on an empty locale).
;
; Why our own: the in-app update moves users of the old per-machine MSI (UAC
; on every update) to this per-user installer. The stock template removes the
; MSI with its own UninstallString, which asks "Are you sure you want to
; uninstall this product?" in the middle of an update, and a "No" or a
; cancelled UAC left two copies side by side. If the MSI still cannot be
; removed (no administrator rights), the person chooses: ask again, install
; next to it, or keep it. The update also waits for the closing app to let go
; of its exe instead of stopping on "Error opening file for writing".
;
; A per-user install can still end up where only administrators write: an
; installer started "as administrator" lets the person pick Program Files,
; and every update after that runs without the rights and fails, unless the
; app itself was started as administrator. The update now offers to move the
; app to the account's folder (BastyonUpdateReadOnly), and the directory page
; warns about such a folder (BastyonLeaveDirectory).
ManifestDPIAware true
; Add in `dpiAwareness` `PerMonitorV2` to manifest for Windows 10 1607+ (note this should not affect lower versions since they should be able to ignore this and pick up `dpiAware` `true` set by `ManifestDPIAware true`)
; Currently undocumented on NSIS's website but is in the Docs folder of source tree, see
; https://github.com/kichik/nsis/blob/5fc0b87b819a9eec006df4967d08e522ddd651c9/Docs/src/attributes.but#L286-L300
; https://github.com/tauri-apps/tauri/pull/10106
ManifestDPIAwareness PerMonitorV2

!if "{{compression}}" == "none"
  SetCompress off
!else
  ; Set the compression algorithm. We default to LZMA.
  SetCompressor /SOLID "{{compression}}"
!endif

; Keep above !include to stay ahead of any plugin command
; see https://github.com/tauri-apps/tauri/pull/15422#discussion_r3289239624
{{#if signed_plugins_path}}
!addplugindir "{{signed_plugins_path}}"
{{/if}}

!include MUI2.nsh
!include FileFunc.nsh
!include x64.nsh
!include WordFunc.nsh
!include "utils.nsh"
!include "FileAssociation.nsh"
!include "Win\COM.nsh"
!include "Win\Propkey.nsh"
!include "StrFunc.nsh"
${StrCase}
${StrLoc}

{{#if installer_hooks}}
!include "{{installer_hooks}}"
{{/if}}

!define WEBVIEW2APPGUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

!define MANUFACTURER "{{manufacturer}}"
!define PRODUCTNAME "{{product_name}}"
!define VERSION "{{version}}"
!define VERSIONWITHBUILD "{{version_with_build}}"
!define HOMEPAGE "{{homepage}}"
!define INSTALLMODE "{{install_mode}}"
!define LICENSE "{{license}}"
!define INSTALLERICON "{{installer_icon}}"
!define SIDEBARIMAGE "{{sidebar_image}}"
!define HEADERIMAGE "{{header_image}}"
!define UNINSTALLERICON "{{uninstaller_icon}}"
!define UNINSTALLERHEADERIMAGE "{{uninstaller_header_image}}"
!define MAINBINARYNAME "{{main_binary_name}}"
!define MAINBINARYSRCPATH "{{main_binary_path}}"
!define BUNDLEID "{{bundle_id}}"
!define COPYRIGHT "{{copyright}}"
!define OUTFILE "{{out_file}}"
!define ARCH "{{arch}}"
!define ADDITIONALPLUGINSPATH "{{additional_plugins_path}}"
!define ALLOWDOWNGRADES "{{allow_downgrades}}"
!define DISPLAYLANGUAGESELECTOR "{{display_language_selector}}"
!define INSTALLWEBVIEW2MODE "{{install_webview2_mode}}"
!define WEBVIEW2INSTALLERARGS "{{webview2_installer_args}}"
!define WEBVIEW2BOOTSTRAPPERPATH "{{webview2_bootstrapper_path}}"
!define WEBVIEW2INSTALLERPATH "{{webview2_installer_path}}"
!define MINIMUMWEBVIEW2VERSION "{{minimum_webview2_version}}"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
!define MANUKEY "Software\${MANUFACTURER}"
!define MANUPRODUCTKEY "${MANUKEY}\${PRODUCTNAME}"
!define UNINSTALLERSIGNCOMMAND "{{uninstaller_sign_cmd}}"
!define ESTIMATEDSIZE "{{estimated_size}}"
!define STARTMENUFOLDER "{{start_menu_folder}}"

Var PassiveMode
Var UpdateMode
Var NoShortcutMode
Var WixMode
; BASTYON: the MSI product code, to remove it with msiexec /x and no question.
Var WixProductCode
Var OldMainBinaryName
; BASTYON: the folder this run moves the app out of (only administrators may
; write there), to retarget its shortcuts and remove the old copy afterwards.
Var BastyonOldDir
; BASTYON: in and out of BastyonCanWrite, BastyonIsProtected and the shortcut
; helpers (own variables, so the $R registers of PageReinstall stay intact).
Var BastyonDir
Var BastyonResult
Var BastyonWritable
Var BastyonProbe
Var BastyonProbeFile
Var BastyonFind
Var BastyonFound
Var BastyonLnk

Name "${PRODUCTNAME}"
BrandingText "${COPYRIGHT}"
OutFile "${OUTFILE}"

; We don't actually use this value as default install path,
; it's just for nsis to append the product name folder in the directory selector
; https://nsis.sourceforge.io/Reference/InstallDir
!define PLACEHOLDER_INSTALL_DIR "placeholder\${PRODUCTNAME}"
InstallDir "${PLACEHOLDER_INSTALL_DIR}"

VIProductVersion "${VERSIONWITHBUILD}"
VIAddVersionKey "ProductName" "${PRODUCTNAME}"
VIAddVersionKey "FileDescription" "${PRODUCTNAME}"
VIAddVersionKey "LegalCopyright" "${COPYRIGHT}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"

# additional plugins
!addplugindir "${ADDITIONALPLUGINSPATH}"

; Uninstaller signing command
!if "${UNINSTALLERSIGNCOMMAND}" != ""
  !uninstfinalize '${UNINSTALLERSIGNCOMMAND}'
!endif

; Handle install mode, `perUser`, `perMachine` or `both`
!if "${INSTALLMODE}" == "perMachine"
  RequestExecutionLevel admin
!endif

!if "${INSTALLMODE}" == "currentUser"
  RequestExecutionLevel user
!endif

!if "${INSTALLMODE}" == "both"
  !define MULTIUSER_MUI
  !define MULTIUSER_INSTALLMODE_INSTDIR "${PRODUCTNAME}"
  !define MULTIUSER_INSTALLMODE_COMMANDLINE
  !if "${ARCH}" == "x64"
    !define MULTIUSER_USE_PROGRAMFILES64
  !else if "${ARCH}" == "arm64"
    !define MULTIUSER_USE_PROGRAMFILES64
  !endif
  !define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_KEY "${UNINSTKEY}"
  !define MULTIUSER_INSTALLMODE_DEFAULT_REGISTRY_VALUENAME "CurrentUser"
  !define MULTIUSER_INSTALLMODEPAGE_SHOWUSERNAME
  !define MULTIUSER_INSTALLMODE_FUNCTION RestorePreviousInstallLocation
  !define MULTIUSER_EXECUTIONLEVEL Highest
  !include MultiUser.nsh
!endif

; Installer icon
!if "${INSTALLERICON}" != ""
  !define MUI_ICON "${INSTALLERICON}"
!endif

; Installer sidebar image
!if "${SIDEBARIMAGE}" != ""
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${SIDEBARIMAGE}"
!endif

; Enable header images for installer and uninstaller pages when either image is configured.
!if "${HEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE
!else if "${UNINSTALLERHEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE
!endif

; Installer header image
!if "${HEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE_BITMAP "${HEADERIMAGE}"
!endif

; Uninstaller header image
!if "${UNINSTALLERHEADERIMAGE}" != ""
  !define MUI_HEADERIMAGE_UNBITMAP "${UNINSTALLERHEADERIMAGE}"
!endif

; Uninstaller icon
!if "${UNINSTALLERICON}" != ""
  !define MUI_UNICON "${UNINSTALLERICON}"
!endif

; Define registry key to store installer language
!define MUI_LANGDLL_REGISTRY_ROOT "HKCU"
!define MUI_LANGDLL_REGISTRY_KEY "${MANUPRODUCTKEY}"
!define MUI_LANGDLL_REGISTRY_VALUENAME "Installer Language"

; Installer pages, must be ordered as they appear
; 1. Welcome Page
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
!insertmacro MUI_PAGE_WELCOME

; 2. License Page (if defined)
!if "${LICENSE}" != ""
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
  !insertmacro MUI_PAGE_LICENSE "${LICENSE}"
!endif

; 3. Install mode (if it is set to `both`)
!if "${INSTALLMODE}" == "both"
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
  !insertmacro MULTIUSER_PAGE_INSTALLMODE
!endif

; 4. Custom page to ask user if he wants to reinstall/uninstall
;    only if a previous installation was detected
Var ReinstallPageCheck
Page custom PageReinstall PageLeaveReinstall
Function PageReinstall
  ; BASTYON: an update of the per-user install leaves an MSI copy alone: the
  ; person kept it ("Ignore" in PageLeaveReinstall), and removing it would ask
  ; for administrator rights on every update.
  ${If} $UpdateMode = 1
    ReadRegStr $R0 SHCTX "${UNINSTKEY}" "UninstallString"
    ${IfThen} $R0 != "" ${|} Goto wix_loop_done ${|}
  ${EndIf}

  ; Uninstall previous WiX installation if exists.
  ;
  ; A WiX installer stores the installation info in registry
  ; using a UUID and so we have to loop through all keys under
  ; `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
  ; and check if `DisplayName` and `Publisher` keys match ${PRODUCTNAME} and ${MANUFACTURER}
  ;
  ; This has a potential issue that there maybe another installation that matches
  ; our ${PRODUCTNAME} and ${MANUFACTURER} but wasn't installed by our WiX installer,
  ; however, this should be fine since the user will have to confirm the uninstallation
  ; and they can chose to abort it if doesn't make sense.
  StrCpy $0 0
  wix_loop:
    EnumRegKey $1 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" $0
    StrCmp $1 "" wix_loop_done ; Exit loop if there is no more keys to loop on
    IntOp $0 $0 + 1
    ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$1" "DisplayName"
    ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$1" "Publisher"
    StrCmp "$R0$R1" "${PRODUCTNAME}${MANUFACTURER}" 0 wix_loop
    ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
    ${StrCase} $R1 $R0 "L"
    ${StrLoc} $R0 $R1 "msiexec" ">"
    StrCmp $R0 0 0 wix_loop_done
    StrCpy $WixMode 1
    StrCpy $WixProductCode $1 ; BASTYON
    StrCpy $R6 "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$1"
    Goto compare_version
  wix_loop_done:

  ; Check if there is an existing installation, if not, abort the reinstall page
  ReadRegStr $R0 SHCTX "${UNINSTKEY}" ""
  ReadRegStr $R1 SHCTX "${UNINSTKEY}" "UninstallString"
  ${IfThen} "$R0$R1" == "" ${|} Abort ${|}

  ; Compare this installar version with the existing installation
  ; and modify the messages presented to the user accordingly
  compare_version:
  StrCpy $R4 "$(older)"
  ${If} $WixMode = 1
    ReadRegStr $R0 HKLM "$R6" "DisplayVersion"
  ${Else}
    ReadRegStr $R0 SHCTX "${UNINSTKEY}" "DisplayVersion"
  ${EndIf}
  ${IfThen} $R0 == "" ${|} StrCpy $R4 "$(unknown)" ${|}

  nsis_tauri_utils::SemverCompare "${VERSION}" $R0
  Pop $R0
  ; Reinstalling the same version
  ${If} $R0 = 0
    StrCpy $R1 "$(alreadyInstalledLong)"
    StrCpy $R2 "$(addOrReinstall)"
    StrCpy $R3 "$(uninstallApp)"
    !insertmacro MUI_HEADER_TEXT "$(alreadyInstalled)" "$(chooseMaintenanceOption)"
  ; Upgrading
  ${ElseIf} $R0 = 1
    StrCpy $R1 "$(olderOrUnknownVersionInstalled)"
    StrCpy $R2 "$(uninstallBeforeInstalling)"
    StrCpy $R3 "$(dontUninstall)"
    !insertmacro MUI_HEADER_TEXT "$(alreadyInstalled)" "$(choowHowToInstall)"
  ; Downgrading
  ${ElseIf} $R0 = -1
    StrCpy $R1 "$(newerVersionInstalled)"
    StrCpy $R2 "$(uninstallBeforeInstalling)"
    !if "${ALLOWDOWNGRADES}" == "true"
      StrCpy $R3 "$(dontUninstall)"
    !else
      StrCpy $R3 "$(dontUninstallDowngrade)"
    !endif
    !insertmacro MUI_HEADER_TEXT "$(alreadyInstalled)" "$(choowHowToInstall)"
  ${Else}
    Abort
  ${EndIf}

  ; Skip showing the page if passive
  ;
  ; Note that we don't call this earlier at the begining
  ; of this function because we need to populate some variables
  ; related to current installed version if detected and whether
  ; we are downgrading or not.
  ${If} $PassiveMode = 1
    Call PageLeaveReinstall
  ${Else}
    nsDialogs::Create 1018
    Pop $R4
    ${IfThen} $(^RTL) = 1 ${|} nsDialogs::SetRTL $(^RTL) ${|}

    ${NSD_CreateLabel} 0 0 100% 24u $R1
    Pop $R1

    ${NSD_CreateRadioButton} 30u 50u -30u 8u $R2
    Pop $R2
    ${NSD_OnClick} $R2 PageReinstallUpdateSelection

    ${NSD_CreateRadioButton} 30u 70u -30u 8u $R3
    Pop $R3
    ; Disable this radio button if downgrading and downgrades are disabled
    !if "${ALLOWDOWNGRADES}" == "false"
      ${IfThen} $R0 = -1 ${|} EnableWindow $R3 0 ${|}
    !endif
    ${NSD_OnClick} $R3 PageReinstallUpdateSelection

    ; Check the first radio button if this the first time
    ; we enter this page or if the second button wasn't
    ; selected the last time we were on this page
    ${If} $ReinstallPageCheck <> 2
      SendMessage $R2 ${BM_SETCHECK} ${BST_CHECKED} 0
    ${Else}
      SendMessage $R3 ${BM_SETCHECK} ${BST_CHECKED} 0
    ${EndIf}

    ${NSD_SetFocus} $R2
    nsDialogs::Show
  ${EndIf}
FunctionEnd
Function PageReinstallUpdateSelection
  ${NSD_GetState} $R2 $R1
  ${If} $R1 == ${BST_CHECKED}
    StrCpy $ReinstallPageCheck 1
  ${Else}
    StrCpy $ReinstallPageCheck 2
  ${EndIf}
FunctionEnd
Function PageLeaveReinstall
  ${NSD_GetState} $R2 $R1

  ; If migrating from Wix, always uninstall
  ${If} $WixMode = 1
    Goto reinst_uninstall
  ${EndIf}

  ; In update mode, always proceeds without uninstalling
  ${If} $UpdateMode = 1
    Goto reinst_done
  ${EndIf}

  ; $R0 holds whether same(0)/upgrading(1)/downgrading(-1) version
  ; $R1 holds the radio buttons state:
  ;   1 => first choice was selected
  ;   0 => second choice was selected
  ${If} $R0 = 0 ; Same version, proceed
    ${If} $R1 = 1              ; User chose to add/reinstall
      Goto reinst_done
    ${Else}                    ; User chose to uninstall
      Goto reinst_uninstall
    ${EndIf}
  ${ElseIf} $R0 = 1 ; Upgrading
    ${If} $R1 = 1              ; User chose to uninstall
      Goto reinst_uninstall
    ${Else}
      Goto reinst_done         ; User chose NOT to uninstall
    ${EndIf}
  ${ElseIf} $R0 = -1 ; Downgrading
    ${If} $R1 = 1              ; User chose to uninstall
      Goto reinst_uninstall
    ${Else}
      Goto reinst_done         ; User chose NOT to uninstall
    ${EndIf}
  ${EndIf}

  reinst_uninstall:
    ; BASTYON: the previous per-user install sits where this installer cannot
    ; write (Program Files, picked once by an installer run as administrator).
    ; Its uninstaller would remove the registry entries and shortcuts and
    ; leave every file behind. Install instead: the directory page offers the
    ; account's folder, and the old copy goes after the install.
    ${If} $WixMode <> 1
      StrCpy $BastyonDir $INSTDIR
      Call BastyonCanWrite
      ${IfThen} $BastyonResult = 0 ${|} Goto reinst_done ${|}
    ${EndIf}

    HideWindow
    ClearErrors

    ${If} $WixMode = 1
      ; BASTYON: msiexec with a progress bar instead of UninstallString, so
      ; the only question left is UAC (the MSI was per-machine). 3010: removed,
      ; some files go at the next reboot. 1605: the product is already gone.
      ExecWait '"$SYSDIR\msiexec.exe" /x $WixProductCode /passive /norestart' $0
      ${If} $0 = 3010
      ${OrIf} $0 = 1605
        StrCpy $0 0
      ${EndIf}
    ${Else}
      ReadRegStr $4 SHCTX "${MANUPRODUCTKEY}" ""
      ReadRegStr $R1 SHCTX "${UNINSTKEY}" "UninstallString"
      ${IfThen} $UpdateMode = 1 ${|} StrCpy $R1 "$R1 /UPDATE" ${|} ; append /UPDATE
      ${IfThen} $PassiveMode = 1 ${|} StrCpy $R1 "$R1 /P" ${|} ; append /P
      StrCpy $R1 "$R1 _?=$4" ; append uninstall directory
      ExecWait '$R1' $0
    ${EndIf}

    BringToFront

    ${IfThen} ${Errors} ${|} StrCpy $0 2 ${|} ; ExecWait failed, set fake exit code

    ${If} $0 <> 0
    ${OrIf} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
      ; BASTYON: an in-app update (/UPDATE) and the MSI was not removed (UAC
      ; cancelled, no administrator rights, msiexec failed). Before, the old
      ; version silently started again, and the update "broke" every time.
      ; Now the person chooses: Retry asks for the rights again, Ignore
      ; installs the new version for this account next to the old one,
      ; Abort starts the old version again.
      ${If} $WixMode = 1
      ${AndIf} $UpdateMode = 1
      ${AndIf} $0 <> 0
        MessageBox MB_ICONEXCLAMATION|MB_ABORTRETRYIGNORE|MB_DEFBUTTON2 "$(bastyonMsiNotRemoved)" /SD IDABORT IDRETRY reinst_uninstall IDIGNORE reinst_done
        ReadRegStr $R1 HKCU "${MANUPRODUCTKEY}" "InstallDir"
        ${If} ${FileExists} "$R1${MAINBINARYNAME}.exe"
          Exec '"$R1${MAINBINARYNAME}.exe"'
        ${ElseIf} ${FileExists} "$R1\${MAINBINARYNAME}.exe"
          Exec '"$R1\${MAINBINARYNAME}.exe"'
        ${EndIf}
        Quit
      ${EndIf}

      ; User cancelled wix uninstaller? return to select un/reinstall page
      ${If} $WixMode = 1
      ${AndIf} $0 = 1602
        Abort
      ${EndIf}

      ; User cancelled NSIS uninstaller? return to select un/reinstall page
      ${If} $0 = 1
        Abort
      ${EndIf}

      ; Other erros? show generic error message and return to select un/reinstall page
      MessageBox MB_ICONEXCLAMATION "$(unableToUninstall)"
      Abort
    ${EndIf}
  reinst_done:
FunctionEnd

; 5. Choose install directory page
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE BastyonLeaveDirectory ; BASTYON
!insertmacro MUI_PAGE_DIRECTORY

; 6. Start menu shortcut page
Var AppStartMenuFolder
!if "${STARTMENUFOLDER}" != ""
  !define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
  !define MUI_STARTMENUPAGE_DEFAULTFOLDER "${STARTMENUFOLDER}"
!else
  !define MUI_PAGE_CUSTOMFUNCTION_PRE Skip
!endif
!insertmacro MUI_PAGE_STARTMENU Application $AppStartMenuFolder

; 7. Installation page
!insertmacro MUI_PAGE_INSTFILES

; 8. Finish page
;
; Don't auto jump to finish page after installation page,
; because the installation page has useful info that can be used debug any issues with the installer.
!define MUI_FINISHPAGE_NOAUTOCLOSE
; Use show readme button in the finish page as a button create a desktop shortcut
!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT "$(createDesktop)"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION CreateOrUpdateDesktopShortcut
; Show run app after installation.
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION RunMainBinary
!define MUI_PAGE_CUSTOMFUNCTION_PRE SkipIfPassive
!insertmacro MUI_PAGE_FINISH

Function RunMainBinary
  nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" ""
FunctionEnd

; Uninstaller Pages
; 1. Confirm uninstall page
Var DeleteAppDataCheckbox
Var DeleteAppDataCheckboxState
!define /ifndef WS_EX_LAYOUTRTL         0x00400000
!define MUI_PAGE_CUSTOMFUNCTION_SHOW un.ConfirmShow
Function un.ConfirmShow ; Add add a `Delete app data` check box
  ; $1 inner dialog HWND
  ; $2 window DPI
  ; $3 style
  ; $4 x
  ; $5 y
  ; $6 width
  ; $7 height
  FindWindow $1 "#32770" "" $HWNDPARENT ; Find inner dialog
  System::Call "user32::GetDpiForWindow(p r1) i .r2"
  ${If} $(^RTL) = 1
    StrCpy $3 "${__NSD_CheckBox_EXSTYLE} | ${WS_EX_LAYOUTRTL}"
    IntOp $4 50 * $2
  ${Else}
    StrCpy $3 "${__NSD_CheckBox_EXSTYLE}"
    IntOp $4 0 * $2
  ${EndIf}
  IntOp $5 100 * $2
  IntOp $6 400 * $2
  IntOp $7 25 * $2
  IntOp $4 $4 / 96
  IntOp $5 $5 / 96
  IntOp $6 $6 / 96
  IntOp $7 $7 / 96
  System::Call 'user32::CreateWindowEx(i r3, w "${__NSD_CheckBox_CLASS}", w "$(deleteAppData)", i ${__NSD_CheckBox_STYLE}, i r4, i r5, i r6, i r7, p r1, i0, i0, i0) i .s'
  Pop $DeleteAppDataCheckbox
  SendMessage $HWNDPARENT ${WM_GETFONT} 0 0 $1
  SendMessage $DeleteAppDataCheckbox ${WM_SETFONT} $1 1
FunctionEnd
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE un.ConfirmLeave
Function un.ConfirmLeave
  SendMessage $DeleteAppDataCheckbox ${BM_GETCHECK} 0 0 $DeleteAppDataCheckboxState
FunctionEnd
!define MUI_PAGE_CUSTOMFUNCTION_PRE un.SkipIfPassive
!insertmacro MUI_UNPAGE_CONFIRM

; 2. Uninstalling Page
!insertmacro MUI_UNPAGE_INSTFILES

;Languages
{{#each languages}}
!insertmacro MUI_LANGUAGE "{{this}}"
{{/each}}
!insertmacro MUI_RESERVEFILE_LANGDLL
{{#each language_files}}
  !include "{{this}}"
{{/each}}

; BASTYON: the MSI was not removed during an update (PageLeaveReinstall). One
; string per language in tauri.conf.json bundle.windows.nsis.languages; the
; button names are Windows' own, in the system language. $0 is the msiexec code.
LangString bastyonMsiNotRemoved ${LANG_ENGLISH} "The previous version of ${PRODUCTNAME} is installed for all users, and removing it needs administrator rights. Windows did not remove it (code $0).$\r$\n$\r$\nRetry: ask for the rights again.$\r$\nIgnore: install the new version for your account only; remove the previous one later in Settings > Apps.$\r$\nAbort: keep the previous version."
LangString bastyonMsiNotRemoved ${LANG_RUSSIAN} "Прежняя версия ${PRODUCTNAME} установлена для всех пользователей, и для её удаления нужны права администратора. Windows её не удалила (код $0).$\r$\n$\r$\n«Повторить» — спросить права ещё раз.$\r$\n«Пропустить» — поставить новую версию только для вашей учётной записи, а прежнюю удалить позже в «Параметры → Приложения».$\r$\n«Прервать» — оставить прежнюю версию."
LangString bastyonMsiNotRemoved ${LANG_GERMAN} "Die vorherige Version von ${PRODUCTNAME} ist für alle Benutzer installiert, und zum Entfernen sind Administratorrechte nötig. Windows hat sie nicht entfernt (Code $0).$\r$\n$\r$\nWiederholen: erneut nach den Rechten fragen.$\r$\nIgnorieren: die neue Version nur für Ihr Konto installieren; die vorherige später unter Einstellungen > Apps entfernen.$\r$\nAbbrechen: die vorherige Version behalten."
LangString bastyonMsiNotRemoved ${LANG_SPANISH} "La versión anterior de ${PRODUCTNAME} está instalada para todos los usuarios y para quitarla se necesitan permisos de administrador. Windows no la quitó (código $0).$\r$\n$\r$\nReintentar: volver a pedir los permisos.$\r$\nOmitir: instalar la nueva versión solo para su cuenta; quite la anterior más tarde en Configuración > Aplicaciones.$\r$\nAnular: conservar la versión anterior."
LangString bastyonMsiNotRemoved ${LANG_FRENCH} "La version précédente de ${PRODUCTNAME} est installée pour tous les utilisateurs, et sa suppression demande des droits d'administrateur. Windows ne l'a pas supprimée (code $0).$\r$\n$\r$\nRecommencer : redemander les droits.$\r$\nIgnorer : installer la nouvelle version pour votre compte seulement ; supprimez l'ancienne plus tard dans Paramètres > Applications.$\r$\nAbandonner : garder la version précédente."
LangString bastyonMsiNotRemoved ${LANG_ITALIAN} "La versione precedente di ${PRODUCTNAME} è installata per tutti gli utenti e per rimuoverla servono i diritti di amministratore. Windows non l'ha rimossa (codice $0).$\r$\n$\r$\nRiprova: chiedere di nuovo i diritti.$\r$\nIgnora: installare la nuova versione solo per il tuo account; rimuovi la precedente più tardi in Impostazioni > App.$\r$\nInterrompi: mantenere la versione precedente."
LangString bastyonMsiNotRemoved ${LANG_KOREAN} "이전 버전의 ${PRODUCTNAME}은(는) 모든 사용자용으로 설치되어 있어 제거하려면 관리자 권한이 필요합니다. Windows가 제거하지 못했습니다(코드 $0).$\r$\n$\r$\n다시 시도: 권한을 다시 요청합니다.$\r$\n무시: 새 버전을 내 계정에만 설치합니다. 이전 버전은 나중에 설정 > 앱에서 제거하세요.$\r$\n중단: 이전 버전을 유지합니다."
LangString bastyonMsiNotRemoved ${LANG_SIMPCHINESE} "${PRODUCTNAME} 的旧版本是为所有用户安装的，删除它需要管理员权限。Windows 未能删除它（代码 $0）。$\r$\n$\r$\n重试：再次请求权限。$\r$\n忽略：仅为您的帐户安装新版本；稍后在“设置 > 应用”中删除旧版本。$\r$\n中止：保留旧版本。"

; BASTYON: the install stands where only administrators may write
; (BastyonUpdateReadOnly, BastyonLeaveDirectory, BastyonAfterMove). Yes / No /
; Cancel are Windows' own buttons, in the system language.
LangString bastyonUpdateNoWrite ${LANG_ENGLISH} "${PRODUCTNAME} is installed in “$INSTDIR”, which cannot be written to without administrator rights, so it cannot be updated there.$\r$\n$\r$\nYes: move it to your account’s folder “$LOCALAPPDATA\${PRODUCTNAME}”. Updates will no longer need the rights, and your accounts and chats stay. Windows will then offer to delete the old copy, which needs administrator rights; you can decline.$\r$\nNo: update it where it is; Windows will ask for administrator rights.$\r$\nCancel: keep the current version."
LangString bastyonUpdateNoWrite ${LANG_RUSSIAN} "${PRODUCTNAME} установлен в папку «$INSTDIR», куда без прав администратора записывать нельзя, поэтому обновить его там не получится.$\r$\n$\r$\n«Да» — перенести в папку вашей учётной записи «$LOCALAPPDATA\${PRODUCTNAME}». Обновлениям права больше не понадобятся, аккаунты и переписка останутся. Затем Windows предложит удалить старую копию — для этого нужны права администратора, можно отказаться.$\r$\n«Нет» — обновить на месте, Windows спросит права администратора.$\r$\n«Отмена» — оставить прежнюю версию."
LangString bastyonUpdateNoWrite ${LANG_GERMAN} "${PRODUCTNAME} ist in „$INSTDIR“ installiert, wo ohne Administratorrechte nicht geschrieben werden kann, deshalb lässt es sich dort nicht aktualisieren.$\r$\n$\r$\nJa: in den Ordner Ihres Kontos „$LOCALAPPDATA\${PRODUCTNAME}“ verschieben. Updates brauchen dann keine Rechte mehr, Konten und Chats bleiben erhalten. Danach bietet Windows an, die alte Kopie zu löschen; dafür sind Administratorrechte nötig, Sie können ablehnen.$\r$\nNein: an Ort und Stelle aktualisieren; Windows fragt nach Administratorrechten.$\r$\nAbbrechen: die aktuelle Version behalten."
LangString bastyonUpdateNoWrite ${LANG_SPANISH} "${PRODUCTNAME} está instalado en «$INSTDIR», donde no se puede escribir sin permisos de administrador, así que no se puede actualizar ahí.$\r$\n$\r$\nSí: moverlo a la carpeta de su cuenta «$LOCALAPPDATA\${PRODUCTNAME}». Las actualizaciones ya no necesitarán permisos, y sus cuentas y chats se conservan. Después Windows ofrecerá eliminar la copia antigua, lo que requiere permisos de administrador; puede rechazarlo.$\r$\nNo: actualizar en el mismo lugar; Windows pedirá permisos de administrador.$\r$\nCancelar: conservar la versión actual."
LangString bastyonUpdateNoWrite ${LANG_FRENCH} "${PRODUCTNAME} est installé dans « $INSTDIR », où l'on ne peut pas écrire sans droits d'administrateur ; il ne peut donc pas y être mis à jour.$\r$\n$\r$\nOui : le déplacer dans le dossier de votre compte « $LOCALAPPDATA\${PRODUCTNAME} ». Les mises à jour n'auront plus besoin de droits, vos comptes et discussions sont conservés. Windows proposera ensuite de supprimer l'ancienne copie, ce qui demande des droits d'administrateur ; vous pouvez refuser.$\r$\nNon : mettre à jour sur place ; Windows demandera des droits d'administrateur.$\r$\nAnnuler : garder la version actuelle."
LangString bastyonUpdateNoWrite ${LANG_ITALIAN} "${PRODUCTNAME} è installato in «$INSTDIR», dove non si può scrivere senza diritti di amministratore, quindi non può essere aggiornato lì.$\r$\n$\r$\nSì: spostarlo nella cartella del tuo account «$LOCALAPPDATA\${PRODUCTNAME}». Gli aggiornamenti non richiederanno più i diritti, account e chat restano. Poi Windows proporrà di eliminare la vecchia copia, cosa che richiede i diritti di amministratore; puoi rifiutare.$\r$\nNo: aggiornare sul posto; Windows chiederà i diritti di amministratore.$\r$\nAnnulla: mantenere la versione attuale."
LangString bastyonUpdateNoWrite ${LANG_KOREAN} "${PRODUCTNAME}이(가) 관리자 권한 없이는 쓸 수 없는 폴더 “$INSTDIR”에 설치되어 있어 그 위치에서는 업데이트할 수 없습니다.$\r$\n$\r$\n예: 내 계정 폴더 “$LOCALAPPDATA\${PRODUCTNAME}”(으)로 옮깁니다. 이후 업데이트에는 권한이 필요 없으며 계정과 채팅은 그대로 유지됩니다. 이어서 Windows가 이전 사본 삭제를 제안합니다. 삭제에는 관리자 권한이 필요하며 거절해도 됩니다.$\r$\n아니요: 현재 위치에서 업데이트합니다. Windows가 관리자 권한을 요청합니다.$\r$\n취소: 현재 버전을 유지합니다."
LangString bastyonUpdateNoWrite ${LANG_SIMPCHINESE} "${PRODUCTNAME} 安装在“$INSTDIR”，没有管理员权限无法写入该文件夹，因此无法在原位置更新。$\r$\n$\r$\n是：移动到您帐户的文件夹“$LOCALAPPDATA\${PRODUCTNAME}”。以后更新不再需要权限，帐户和聊天都会保留。随后 Windows 会提示删除旧副本，这需要管理员权限，您可以拒绝。$\r$\n否：在原位置更新，Windows 会请求管理员权限。$\r$\n取消：保留当前版本。"

LangString bastyonDirNoWrite ${LANG_ENGLISH} "The folder “$INSTDIR” cannot be written to without administrator rights.$\r$\n$\r$\nInstall ${PRODUCTNAME} in your account’s folder “$LOCALAPPDATA\${PRODUCTNAME}” instead? It needs no rights, neither to install nor to update.$\r$\n$\r$\nNo: choose another folder."
LangString bastyonDirNoWrite ${LANG_RUSSIAN} "В папку «$INSTDIR» нельзя записывать без прав администратора.$\r$\n$\r$\nПоставить ${PRODUCTNAME} в папку вашей учётной записи «$LOCALAPPDATA\${PRODUCTNAME}»? Для неё права не нужны ни при установке, ни при обновлениях.$\r$\n$\r$\n«Нет» — выбрать другую папку."
LangString bastyonDirNoWrite ${LANG_GERMAN} "In den Ordner „$INSTDIR“ kann ohne Administratorrechte nicht geschrieben werden.$\r$\n$\r$\n${PRODUCTNAME} stattdessen im Ordner Ihres Kontos „$LOCALAPPDATA\${PRODUCTNAME}“ installieren? Dafür sind keine Rechte nötig, weder bei der Installation noch bei Updates.$\r$\n$\r$\nNein: einen anderen Ordner wählen."
LangString bastyonDirNoWrite ${LANG_SPANISH} "En la carpeta «$INSTDIR» no se puede escribir sin permisos de administrador.$\r$\n$\r$\n¿Instalar ${PRODUCTNAME} en la carpeta de su cuenta «$LOCALAPPDATA\${PRODUCTNAME}»? No necesita permisos ni para instalar ni para actualizar.$\r$\n$\r$\nNo: elegir otra carpeta."
LangString bastyonDirNoWrite ${LANG_FRENCH} "Impossible d'écrire dans le dossier « $INSTDIR » sans droits d'administrateur.$\r$\n$\r$\nInstaller ${PRODUCTNAME} dans le dossier de votre compte « $LOCALAPPDATA\${PRODUCTNAME} » ? Il ne demande aucun droit, ni pour l'installation ni pour les mises à jour.$\r$\n$\r$\nNon : choisir un autre dossier."
LangString bastyonDirNoWrite ${LANG_ITALIAN} "Nella cartella «$INSTDIR» non si può scrivere senza diritti di amministratore.$\r$\n$\r$\nInstallare ${PRODUCTNAME} nella cartella del tuo account «$LOCALAPPDATA\${PRODUCTNAME}»? Non richiede diritti né per l'installazione né per gli aggiornamenti.$\r$\n$\r$\nNo: scegliere un'altra cartella."
LangString bastyonDirNoWrite ${LANG_KOREAN} "관리자 권한 없이는 “$INSTDIR” 폴더에 쓸 수 없습니다.$\r$\n$\r$\n대신 내 계정 폴더 “$LOCALAPPDATA\${PRODUCTNAME}”에 ${PRODUCTNAME}을(를) 설치할까요? 설치와 업데이트 모두 권한이 필요 없습니다.$\r$\n$\r$\n아니요: 다른 폴더를 선택합니다."
LangString bastyonDirNoWrite ${LANG_SIMPCHINESE} "没有管理员权限无法写入文件夹“$INSTDIR”。$\r$\n$\r$\n改为将 ${PRODUCTNAME} 安装到您帐户的文件夹“$LOCALAPPDATA\${PRODUCTNAME}”吗？安装和更新都不需要权限。$\r$\n$\r$\n否：选择其他文件夹。"

LangString bastyonDirAdminOnly ${LANG_ENGLISH} "Only administrators can write to the folder “$INSTDIR”, so every update of ${PRODUCTNAME} would ask for administrator rights.$\r$\n$\r$\nInstall it in your account’s folder “$LOCALAPPDATA\${PRODUCTNAME}” instead? It needs no rights.$\r$\n$\r$\nNo: keep the chosen folder."
LangString bastyonDirAdminOnly ${LANG_RUSSIAN} "В папку «$INSTDIR» могут записывать только администраторы, поэтому каждое обновление ${PRODUCTNAME} будет просить права администратора.$\r$\n$\r$\nПоставить в папку вашей учётной записи «$LOCALAPPDATA\${PRODUCTNAME}»? Для неё права не нужны.$\r$\n$\r$\n«Нет» — оставить выбранную папку."
LangString bastyonDirAdminOnly ${LANG_GERMAN} "Nur Administratoren können in den Ordner „$INSTDIR“ schreiben, daher würde jedes Update von ${PRODUCTNAME} nach Administratorrechten fragen.$\r$\n$\r$\nStattdessen im Ordner Ihres Kontos „$LOCALAPPDATA\${PRODUCTNAME}“ installieren? Dafür sind keine Rechte nötig.$\r$\n$\r$\nNein: den gewählten Ordner behalten."
LangString bastyonDirAdminOnly ${LANG_SPANISH} "Solo los administradores pueden escribir en la carpeta «$INSTDIR», así que cada actualización de ${PRODUCTNAME} pediría permisos de administrador.$\r$\n$\r$\n¿Instalarlo en la carpeta de su cuenta «$LOCALAPPDATA\${PRODUCTNAME}»? No necesita permisos.$\r$\n$\r$\nNo: mantener la carpeta elegida."
LangString bastyonDirAdminOnly ${LANG_FRENCH} "Seuls les administrateurs peuvent écrire dans le dossier « $INSTDIR » : chaque mise à jour de ${PRODUCTNAME} demanderait des droits d'administrateur.$\r$\n$\r$\nL'installer plutôt dans le dossier de votre compte « $LOCALAPPDATA\${PRODUCTNAME} » ? Il ne demande aucun droit.$\r$\n$\r$\nNon : garder le dossier choisi."
LangString bastyonDirAdminOnly ${LANG_ITALIAN} "Solo gli amministratori possono scrivere nella cartella «$INSTDIR», quindi ogni aggiornamento di ${PRODUCTNAME} chiederebbe i diritti di amministratore.$\r$\n$\r$\nInstallarlo invece nella cartella del tuo account «$LOCALAPPDATA\${PRODUCTNAME}»? Non richiede diritti.$\r$\n$\r$\nNo: mantenere la cartella scelta."
LangString bastyonDirAdminOnly ${LANG_KOREAN} "“$INSTDIR” 폴더에는 관리자만 쓸 수 있으므로 ${PRODUCTNAME}을(를) 업데이트할 때마다 관리자 권한을 요청하게 됩니다.$\r$\n$\r$\n대신 내 계정 폴더 “$LOCALAPPDATA\${PRODUCTNAME}”에 설치할까요? 권한이 필요 없습니다.$\r$\n$\r$\n아니요: 선택한 폴더를 유지합니다."
LangString bastyonDirAdminOnly ${LANG_SIMPCHINESE} "只有管理员可以写入文件夹“$INSTDIR”，因此 ${PRODUCTNAME} 每次更新都会请求管理员权限。$\r$\n$\r$\n改为安装到您帐户的文件夹“$LOCALAPPDATA\${PRODUCTNAME}”吗？该文件夹不需要权限。$\r$\n$\r$\n否：保留所选文件夹。"

LangString bastyonOldCopy ${LANG_ENGLISH} "An old copy of ${PRODUCTNAME} is left in “$BastyonOldDir”. Delete it? Windows will ask for administrator rights."
LangString bastyonOldCopy ${LANG_RUSSIAN} "В прежней папке «$BastyonOldDir» осталась старая копия ${PRODUCTNAME}. Удалить её? Windows спросит права администратора."
LangString bastyonOldCopy ${LANG_GERMAN} "Im bisherigen Ordner „$BastyonOldDir“ ist eine alte Kopie von ${PRODUCTNAME} geblieben. Löschen? Windows fragt nach Administratorrechten."
LangString bastyonOldCopy ${LANG_SPANISH} "En la carpeta anterior «$BastyonOldDir» quedó una copia antigua de ${PRODUCTNAME}. ¿Eliminarla? Windows pedirá permisos de administrador."
LangString bastyonOldCopy ${LANG_FRENCH} "Une ancienne copie de ${PRODUCTNAME} reste dans « $BastyonOldDir ». La supprimer ? Windows demandera des droits d'administrateur."
LangString bastyonOldCopy ${LANG_ITALIAN} "Nella cartella precedente «$BastyonOldDir» è rimasta una vecchia copia di ${PRODUCTNAME}. Eliminarla? Windows chiederà i diritti di amministratore."
LangString bastyonOldCopy ${LANG_KOREAN} "이전 폴더 “$BastyonOldDir”에 ${PRODUCTNAME}의 이전 사본이 남아 있습니다. 삭제할까요? Windows가 관리자 권한을 요청합니다."
LangString bastyonOldCopy ${LANG_SIMPCHINESE} "原文件夹“$BastyonOldDir”中留有 ${PRODUCTNAME} 的旧副本。要删除吗？Windows 会请求管理员权限。"

Function .onInit
  ${GetOptions} $CMDLINE "/P" $PassiveMode
  ${IfNot} ${Errors}
    StrCpy $PassiveMode 1
  ${EndIf}

  ${GetOptions} $CMDLINE "/NS" $NoShortcutMode
  ${IfNot} ${Errors}
    StrCpy $NoShortcutMode 1
  ${EndIf}

  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode
  ${IfNot} ${Errors}
    StrCpy $UpdateMode 1
  ${EndIf}

  !if "${DISPLAYLANGUAGESELECTOR}" == "true"
    !insertmacro MUI_LANGDLL_DISPLAY
  !endif

  !insertmacro SetContext

  ${If} $INSTDIR == "${PLACEHOLDER_INSTALL_DIR}"
    ; Set default install location
    !if "${INSTALLMODE}" == "perMachine"
      ${If} ${RunningX64}
        !if "${ARCH}" == "x64"
          StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCTNAME}"
        !else if "${ARCH}" == "arm64"
          StrCpy $INSTDIR "$PROGRAMFILES64\${PRODUCTNAME}"
        !else
          StrCpy $INSTDIR "$PROGRAMFILES\${PRODUCTNAME}"
        !endif
      ${Else}
        StrCpy $INSTDIR "$PROGRAMFILES\${PRODUCTNAME}"
      ${EndIf}
    !else if "${INSTALLMODE}" == "currentUser"
      StrCpy $INSTDIR "$LOCALAPPDATA\${PRODUCTNAME}"
    !endif

    Call RestorePreviousInstallLocation
  ${EndIf}


  !if "${INSTALLMODE}" == "both"
    !insertmacro MULTIUSER_INIT
  !endif

  ; BASTYON: an in-app update of an install this process cannot write to.
  ${If} $UpdateMode = 1
    Call BastyonUpdateReadOnly
  ${EndIf}
FunctionEnd


Section EarlyChecks
  ; Abort silent installer if downgrades is disabled
  !if "${ALLOWDOWNGRADES}" == "false"
  ${If} ${Silent}
    ; If downgrading
    ${If} $R0 = -1
      System::Call 'kernel32::AttachConsole(i -1)i.r0'
      ${If} $0 <> 0
        System::Call 'kernel32::GetStdHandle(i -11)i.r0'
        System::call 'kernel32::SetConsoleTextAttribute(i r0, i 0x0004)' ; set red color
        FileWrite $0 "$(silentDowngrades)"
      ${EndIf}
      Abort
    ${EndIf}
  ${EndIf}
  !endif

SectionEnd

Section WebView2
  ; Check if Webview2 is already installed and skip this section
  ${If} ${RunningX64}
    ReadRegStr $4 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${Else}
    ReadRegStr $4 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${EndIf}
  ${If} $4 == ""
    ReadRegStr $4 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2APPGUID}" "pv"
  ${EndIf}

  ${If} $4 == ""
    ; Webview2 installation
    ;
    ; Skip if updating
    ${If} $UpdateMode <> 1
      !if "${INSTALLWEBVIEW2MODE}" == "downloadBootstrapper"
        Delete "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        DetailPrint "$(webview2Downloading)"
        NSISdl::download "https://go.microsoft.com/fwlink/p/?LinkId=2124703" "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        Pop $0
        ${If} $0 == "success"
          DetailPrint "$(webview2DownloadSuccess)"
        ${Else}
          DetailPrint "$(webview2DownloadError)"
          Abort "$(webview2AbortError)"
        ${EndIf}
        StrCpy $6 "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        Goto install_webview2
      !endif

      !if "${INSTALLWEBVIEW2MODE}" == "embedBootstrapper"
        Delete "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        File "/oname=$TEMP\MicrosoftEdgeWebview2Setup.exe" "${WEBVIEW2BOOTSTRAPPERPATH}"
        DetailPrint "$(installingWebview2)"
        StrCpy $6 "$TEMP\MicrosoftEdgeWebview2Setup.exe"
        Goto install_webview2
      !endif

      !if "${INSTALLWEBVIEW2MODE}" == "offlineInstaller"
        Delete "$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe"
        File "/oname=$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe" "${WEBVIEW2INSTALLERPATH}"
        DetailPrint "$(installingWebview2)"
        StrCpy $6 "$TEMP\MicrosoftEdgeWebView2RuntimeInstaller.exe"
        Goto install_webview2
      !endif

      Goto webview2_done

      install_webview2:
        DetailPrint "$(installingWebview2)"
        ; $6 holds the path to the webview2 installer
        ExecWait "$6 ${WEBVIEW2INSTALLERARGS} /install" $1
        ${If} $1 = 0
          DetailPrint "$(webview2InstallSuccess)"
        ${Else}
          DetailPrint "$(webview2InstallError)"
          Abort "$(webview2AbortError)"
        ${EndIf}
      webview2_done:
    ${EndIf}
  ${Else}
    !if "${MINIMUMWEBVIEW2VERSION}" != ""
      ${VersionCompare} "${MINIMUMWEBVIEW2VERSION}" "$4" $R0
      ${If} $R0 = 1
        update_webview:
          DetailPrint "$(installingWebview2)"
          ${If} ${RunningX64}
            ReadRegStr $R1 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate" "path"
          ${Else}
            ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\EdgeUpdate" "path"
          ${EndIf}
          ${If} $R1 == ""
            ReadRegStr $R1 HKCU "SOFTWARE\Microsoft\EdgeUpdate" "path"
          ${EndIf}
          ${If} $R1 != ""
            ; Chromium updater docs: https://source.chromium.org/chromium/chromium/src/+/main:docs/updater/user_manual.md
            ; Modified from "HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Microsoft EdgeWebView\ModifyPath"
            ExecWait `"$R1" /install appguid=${WEBVIEW2APPGUID}&needsadmin=true` $1
            ${If} $1 = 0
              DetailPrint "$(webview2InstallSuccess)"
            ${Else}
              MessageBox MB_ICONEXCLAMATION|MB_ABORTRETRYIGNORE "$(webview2InstallError)" IDIGNORE ignore IDRETRY update_webview
              Quit
              ignore:
            ${EndIf}
          ${EndIf}
      ${EndIf}
    !endif
  ${EndIf}
SectionEnd

Section Install
  SetOutPath $INSTDIR

  !ifmacrodef NSIS_HOOK_PREINSTALL
    !insertmacro NSIS_HOOK_PREINSTALL
  !endif

  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"

  ; BASTYON: the app that started the update exits right after starting the
  ; installer, a killed process lets go of its exe a moment later, and an
  ; antivirus scan holds it longer still. `File` then stopped on "Error
  ; opening file for writing" (Abort / Retry / Ignore), which read as missing
  ; rights or files. Wait up to 10 s, then move the old exe aside: Windows
  ; lets a running exe be renamed. The .old file goes with the next update.
  Delete "$INSTDIR\${MAINBINARYNAME}.exe.old"
  ${If} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
    StrCpy $R9 0
    ${Do}
      ClearErrors
      FileOpen $R8 "$INSTDIR\${MAINBINARYNAME}.exe" a
      ${IfNot} ${Errors}
        FileClose $R8
        ${Break}
      ${EndIf}
      IntOp $R9 $R9 + 1
      ${If} $R9 >= 20
        Rename "$INSTDIR\${MAINBINARYNAME}.exe" "$INSTDIR\${MAINBINARYNAME}.exe.old"
        ${Break}
      ${EndIf}
      Sleep 500
    ${Loop}
  ${EndIf}

  ; Copy main executable
  File "${MAINBINARYSRCPATH}"

  ; Copy resources
  {{#each resources_dirs}}
    CreateDirectory "$INSTDIR\\{{this}}"
  {{/each}}
  {{#each resources}}
    File /a "/oname={{this.[1]}}" "{{no-escape @key}}"
  {{/each}}

  ; Copy external binaries
  {{#each binaries}}
    File /a "/oname={{this}}" "{{no-escape @key}}"
  {{/each}}

  ; Create file associations
  {{#each file_associations as |association| ~}}
    {{#each association.ext as |ext| ~}}
       !insertmacro APP_ASSOCIATE "{{ext}}" "{{or association.name ext}}" "{{association-description association.description ext}}" "$INSTDIR\${MAINBINARYNAME}.exe,0" "Open with ${PRODUCTNAME}" "$INSTDIR\${MAINBINARYNAME}.exe $\"%1$\""
    {{/each}}
  {{/each}}

  ; Register deep links
  {{#each deep_link_protocols as |protocol| ~}}
    WriteRegStr SHCTX "Software\Classes\\{{protocol}}" "URL Protocol" ""
    WriteRegStr SHCTX "Software\Classes\\{{protocol}}" "" "URL:${BUNDLEID} protocol"
    WriteRegStr SHCTX "Software\Classes\\{{protocol}}\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
    WriteRegStr SHCTX "Software\Classes\\{{protocol}}\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
  {{/each}}

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Save $INSTDIR in registry for future installations
  WriteRegStr SHCTX "${MANUPRODUCTKEY}" "" $INSTDIR

  !if "${INSTALLMODE}" == "both"
    ; Save install mode to be selected by default for the next installation such as updating
    ; or when uninstalling
    WriteRegStr SHCTX "${UNINSTKEY}" $MultiUser.InstallMode 1
  !endif

  ; Remove old main binary if it doesn't match new main binary name
  ReadRegStr $OldMainBinaryName SHCTX "${UNINSTKEY}" "MainBinaryName"
  ${If} $OldMainBinaryName != ""
  ${AndIf} $OldMainBinaryName != "${MAINBINARYNAME}.exe"
    Delete "$INSTDIR\$OldMainBinaryName"
  ${EndIf}

  ; Save current MAINBINARYNAME for future updates
  WriteRegStr SHCTX "${UNINSTKEY}" "MainBinaryName" "${MAINBINARYNAME}.exe"

  ; Registry information for add/remove programs
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayName" "${PRODUCTNAME}"
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayIcon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\""
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr SHCTX "${UNINSTKEY}" "Publisher" "${MANUFACTURER}"
  WriteRegStr SHCTX "${UNINSTKEY}" "InstallLocation" "$\"$INSTDIR$\""
  WriteRegStr SHCTX "${UNINSTKEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegDWORD SHCTX "${UNINSTKEY}" "NoModify" "1"
  WriteRegDWORD SHCTX "${UNINSTKEY}" "NoRepair" "1"

  ${GetSize} "$INSTDIR" "/M=uninstall.exe /S=0K /G=0" $0 $1 $2
  IntOp $0 $0 + ${ESTIMATEDSIZE}
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD SHCTX "${UNINSTKEY}" "EstimatedSize" "$0"

  !if "${HOMEPAGE}" != ""
    WriteRegStr SHCTX "${UNINSTKEY}" "URLInfoAbout" "${HOMEPAGE}"
    WriteRegStr SHCTX "${UNINSTKEY}" "URLUpdateInfo" "${HOMEPAGE}"
    WriteRegStr SHCTX "${UNINSTKEY}" "HelpLink" "${HOMEPAGE}"
  !endif

  ; Create start menu shortcut
  !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
    Call CreateOrUpdateStartMenuShortcut
  !insertmacro MUI_STARTMENU_WRITE_END

  ; Create desktop shortcut for silent and passive installers
  ; because finish page will be skipped
  ${If} $PassiveMode = 1
  ${OrIf} ${Silent}
    Call CreateOrUpdateDesktopShortcut
  ${EndIf}

  ; BASTYON: moved out of a folder only administrators may write to.
  ${If} $BastyonOldDir != ""
    Call BastyonAfterMove
  ${EndIf}

  !ifmacrodef NSIS_HOOK_POSTINSTALL
    !insertmacro NSIS_HOOK_POSTINSTALL
  !endif

  ; Auto close this page for passive mode
  ${If} $PassiveMode = 1
    SetAutoClose true
  ${EndIf}
SectionEnd

Function .onInstSuccess
  ; Check for `/R` flag only in silent and passive installers because
  ; GUI installer has a toggle for the user to (re)start the app
  ${If} $PassiveMode = 1
  ${OrIf} ${Silent}
    ${GetOptions} $CMDLINE "/R" $R0
    ${IfNot} ${Errors}
      ${GetOptions} $CMDLINE "/ARGS" $R0
      nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" "$R0"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function un.onInit
  !insertmacro SetContext

  !if "${INSTALLMODE}" == "both"
    !insertmacro MULTIUSER_UNINIT
  !endif

  !insertmacro MUI_UNGETLANGUAGE

  ${GetOptions} $CMDLINE "/P" $PassiveMode
  ${IfNot} ${Errors}
    StrCpy $PassiveMode 1
  ${EndIf}

  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode
  ${IfNot} ${Errors}
    StrCpy $UpdateMode 1
  ${EndIf}
FunctionEnd

Section Uninstall

  !ifmacrodef NSIS_HOOK_PREUNINSTALL
    !insertmacro NSIS_HOOK_PREUNINSTALL
  !endif

  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"

  ; Delete the app directory and its content from disk
  ; Copy main executable
  Delete "$INSTDIR\${MAINBINARYNAME}.exe"
  Delete "$INSTDIR\${MAINBINARYNAME}.exe.old" ; BASTYON: see Section Install

  ; Delete resources
  {{#each resources}}
    Delete "$INSTDIR\\{{this.[1]}}"
  {{/each}}

  ; Delete external binaries
  {{#each binaries}}
    Delete "$INSTDIR\\{{this}}"
  {{/each}}

  ; Delete app associations
  {{#each file_associations as |association| ~}}
    {{#each association.ext as |ext| ~}}
      !insertmacro APP_UNASSOCIATE "{{ext}}" "{{or association.name ext}}"
    {{/each}}
  {{/each}}

  ; Delete deep links
  {{#each deep_link_protocols as |protocol| ~}}
    ReadRegStr $R7 SHCTX "Software\Classes\\{{protocol}}\shell\open\command" ""
    ${If} $R7 == "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
      DeleteRegKey SHCTX "Software\Classes\\{{protocol}}"
    ${EndIf}
  {{/each}}


  ; Delete uninstaller
  Delete "$INSTDIR\uninstall.exe"

  {{#each resources_ancestors}}
  RMDir /REBOOTOK "$INSTDIR\\{{this}}"
  {{/each}}
  RMDir "$INSTDIR"

  ; Remove shortcuts if not updating
  ${If} $UpdateMode <> 1
    !insertmacro DeleteAppUserModelId

    ; Remove start menu shortcut
    !insertmacro MUI_STARTMENU_GETFOLDER Application $AppStartMenuFolder
    !insertmacro IsShortcutTarget "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
      Delete "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
      RMDir "$SMPROGRAMS\$AppStartMenuFolder"
    ${EndIf}
    !insertmacro IsShortcutTarget "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk"
      Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    ${EndIf}

    ; Remove desktop shortcuts
    !insertmacro IsShortcutTarget "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$DESKTOP\${PRODUCTNAME}.lnk"
      Delete "$DESKTOP\${PRODUCTNAME}.lnk"
    ${EndIf}
  ${EndIf}

  ; Remove registry information for add/remove programs
  !if "${INSTALLMODE}" == "both"
    DeleteRegKey SHCTX "${UNINSTKEY}"
  !else if "${INSTALLMODE}" == "perMachine"
    DeleteRegKey HKLM "${UNINSTKEY}"
  !else
    DeleteRegKey HKCU "${UNINSTKEY}"
  !endif

  ; Removes the Autostart entry for ${PRODUCTNAME} from the HKCU Run key if it exists.
  ; This ensures the program does not launch automatically after uninstallation if it exists.
  ; If it doesn't exist, it does nothing.
  ; We do this when not updating (to preserve the registry value on updates)
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
  ${EndIf}

  ; Delete app data if the checkbox is selected
  ; and if not updating
  ${If} $DeleteAppDataCheckboxState = 1
  ${AndIf} $UpdateMode <> 1
    ; Clear the install location $INSTDIR from registry
    DeleteRegKey SHCTX "${MANUPRODUCTKEY}"
    DeleteRegKey /ifempty SHCTX "${MANUKEY}"

    ; Clear the install language from registry
    DeleteRegValue HKCU "${MANUPRODUCTKEY}" "Installer Language"
    DeleteRegKey /ifempty HKCU "${MANUPRODUCTKEY}"
    DeleteRegKey /ifempty HKCU "${MANUKEY}"

    SetShellVarContext current
    RmDir /r "$APPDATA\${BUNDLEID}"
    RmDir /r "$LOCALAPPDATA\${BUNDLEID}"
  ${EndIf}

  !ifmacrodef NSIS_HOOK_POSTUNINSTALL
    !insertmacro NSIS_HOOK_POSTUNINSTALL
  !endif

  ; Auto close if passive mode or updating
  ${If} $PassiveMode = 1
  ${OrIf} $UpdateMode = 1
    SetAutoClose true
  ${EndIf}
SectionEnd

Function RestorePreviousInstallLocation
  ReadRegStr $4 SHCTX "${MANUPRODUCTKEY}" ""
  StrCmp $4 "" +2 0
    StrCpy $INSTDIR $4
FunctionEnd

Function Skip
  Abort
FunctionEnd

Function SkipIfPassive
  ${IfThen} $PassiveMode = 1  ${|} Abort ${|}
FunctionEnd
Function un.SkipIfPassive
  ${IfThen} $PassiveMode = 1  ${|} Abort ${|}
FunctionEnd

; BASTYON: $BastyonDir → $BastyonResult = 1 if this process can create files
; there (in the nearest existing folder up the path, if it does not exist
; yet). A probe file, not the ACL: elevated, the installer writes anywhere,
; and the process manifest turns off the VirtualStore redirection.
Function BastyonCanWrite
  StrCpy $BastyonResult 0
  StrCpy $BastyonProbe $BastyonDir
  ${DoUntil} ${FileExists} "$BastyonProbe\*.*"
    ${GetParent} $BastyonProbe $BastyonProbe
    ${IfThen} $BastyonProbe == "" ${|} Return ${|}
  ${Loop}
  ClearErrors
  FileOpen $BastyonProbeFile "$BastyonProbe\.bastyon-write-probe" w
  ${IfNot} ${Errors}
    FileClose $BastyonProbeFile
    Delete "$BastyonProbe\.bastyon-write-probe"
    StrCpy $BastyonResult 1
  ${EndIf}
FunctionEnd

; BASTYON: $BastyonDir → $BastyonResult = 1 inside Program Files or Windows,
; where only administrators may write. Catches the folder an elevated
; installer can write to now, but an update without the rights cannot.
Function BastyonIsProtected
  StrCpy $BastyonResult 0
  Push $PROGRAMFILES64
  Call BastyonUnder
  Push $PROGRAMFILES
  Call BastyonUnder
  Push $WINDIR
  Call BastyonUnder
FunctionEnd
Function BastyonUnder ; root on the stack; $BastyonDir is it or inside it
  Exch $0
  Push $1
  Push $2
  StrLen $1 $0
  ${If} $1 > 0
    StrCpy $2 $BastyonDir $1
    ${If} $2 == $0
      StrCpy $2 $BastyonDir 1 $1
      ${If} $2 == "\"
      ${OrIf} $2 == ""
        StrCpy $BastyonResult 1
      ${EndIf}
    ${EndIf}
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

; BASTYON: leaving the directory page with a folder only administrators may
; write to. Without the rights the install itself fails there; with them,
; every later update fails or asks for them. Offer the account's folder.
Function BastyonLeaveDirectory
  ${If} $INSTDIR == "$LOCALAPPDATA\${PRODUCTNAME}"
    Return
  ${EndIf}
  StrCpy $BastyonDir $INSTDIR
  Call BastyonCanWrite
  StrCpy $BastyonWritable $BastyonResult
  Call BastyonIsProtected
  ${If} $BastyonWritable = 1
  ${AndIf} $BastyonResult = 0
    Return
  ${EndIf}
  ${If} $BastyonWritable = 1
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "$(bastyonDirAdminOnly)" /SD IDNO IDNO bastyon_keep
  ${Else}
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "$(bastyonDirNoWrite)" /SD IDYES IDNO bastyon_back
  ${EndIf}
  ; An older install stood there (PageLeaveReinstall kept it): its shortcuts
  ; and files are dealt with after the install, as on an update.
  ${If} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
    StrCpy $BastyonOldDir $INSTDIR
  ${EndIf}
  StrCpy $INSTDIR "$LOCALAPPDATA\${PRODUCTNAME}"
  ; The page copies its text field into $INSTDIR as it closes, after this
  ; function: without the new folder in the field the install went to the
  ; old one anyway.
  FindWindow $BastyonProbe "#32770" "" $HWNDPARENT
  GetDlgItem $BastyonProbe $BastyonProbe 1019
  SendMessage $BastyonProbe ${WM_SETTEXT} 0 "STR:$INSTDIR"
  bastyon_keep:
  Return
  bastyon_back:
  Abort
FunctionEnd

; BASTYON: an in-app update (/UPDATE) of an install this process cannot write
; to. The updater starts the installer without elevation, so it used to stop
; on "Error opening file for writing" unless the app ran as administrator.
; Yes: install into the account's folder (no rights needed from now on), the
; old copy goes after the install. No: run this installer again elevated, on
; the same folder (/D, since an administrator account other than the
; person's has another $LOCALAPPDATA). Cancel: start the installed version
; again, as the update would have.
Function BastyonUpdateReadOnly
  ${IfNot} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
    Return
  ${EndIf}
  StrCpy $BastyonDir $INSTDIR
  Call BastyonCanWrite
  ${IfThen} $BastyonResult = 1 ${|} Return ${|}

  bastyon_ask:
  MessageBox MB_YESNOCANCEL|MB_ICONEXCLAMATION|MB_SETFOREGROUND|MB_TOPMOST "$(bastyonUpdateNoWrite)" /SD IDYES IDYES bastyon_move IDNO bastyon_elevate
    ClearErrors
    ${GetOptions} $CMDLINE "/R" $BastyonProbe
    ${IfNot} ${Errors}
      Exec '"$INSTDIR\${MAINBINARYNAME}.exe"'
    ${EndIf}
    Quit

  bastyon_move:
    StrCpy $BastyonOldDir $INSTDIR
    StrCpy $INSTDIR "$LOCALAPPDATA\${PRODUCTNAME}"
    Return

  bastyon_elevate:
    ${GetParameters} $BastyonProbe
    ClearErrors
    ExecShell "runas" "$EXEPATH" "$BastyonProbe /D=$INSTDIR"
    ; UAC declined or no administrator to approve it: ask again.
    ${If} ${Errors}
      Goto bastyon_ask
    ${EndIf}
    Quit
FunctionEnd

; BASTYON: after moving out of $BastyonOldDir. Shortcuts that started the old
; copy now start this one (changed in place, so a taskbar pin stays a pin);
; the old copy goes: our three files and then the folder if it is empty, so
; nothing else in it is touched. Without the rights, removing it asks UAC: on
; an update the first question already said so, otherwise ask first.
Function BastyonAfterMove
  StrCpy $BastyonDir "$DESKTOP"
  Call BastyonRetargetIn
  StrCpy $BastyonDir "$SMPROGRAMS"
  Call BastyonRetargetIn
  ${If} $AppStartMenuFolder != ""
    StrCpy $BastyonDir "$SMPROGRAMS\$AppStartMenuFolder"
    Call BastyonRetargetIn
  ${EndIf}
  StrCpy $BastyonDir "$APPDATA\Microsoft\Internet Explorer\Quick Launch"
  Call BastyonRetargetIn
  StrCpy $BastyonDir "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
  Call BastyonRetargetIn
  StrCpy $BastyonDir "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\StartMenu"
  Call BastyonRetargetIn

  Delete "$BastyonOldDir\${MAINBINARYNAME}.exe.old"
  Delete "$BastyonOldDir\${MAINBINARYNAME}.exe"
  Delete "$BastyonOldDir\uninstall.exe"
  RMDir "$BastyonOldDir"
  ${IfNot} ${FileExists} "$BastyonOldDir\${MAINBINARYNAME}.exe"
  ${OrIf} ${Silent}
    Return
  ${EndIf}
  ${If} $UpdateMode <> 1
    MessageBox MB_YESNO|MB_ICONQUESTION "$(bastyonOldCopy)" /SD IDNO IDYES bastyon_remove
    Return
  ${EndIf}
  bastyon_remove:
  ExecShell "runas" "$SYSDIR\cmd.exe" '/c del /f /q "$BastyonOldDir\${MAINBINARYNAME}.exe" "$BastyonOldDir\${MAINBINARYNAME}.exe.old" "$BastyonOldDir\uninstall.exe" & rmdir "$BastyonOldDir"' SW_HIDE
FunctionEnd

; BASTYON: every .lnk in $BastyonDir that starts the old copy.
Function BastyonRetargetIn
  ClearErrors
  FindFirst $BastyonFind $BastyonFound "$BastyonDir\*.lnk"
  ${DoUntil} ${Errors}
    ${If} $BastyonFound != ""
      StrCpy $BastyonLnk "$BastyonDir\$BastyonFound"
      Call BastyonRetargetLnk
    ${EndIf}
    ClearErrors
    FindNext $BastyonFind $BastyonFound
  ${Loop}
  FindClose $BastyonFind
FunctionEnd

; BASTYON: $BastyonLnk → if it starts the old copy's exe, it starts the new
; one, in the new folder (a "Start in" folder that no longer exists makes
; Windows refuse to open the shortcut).
Function BastyonRetargetLnk
  Push $0
  Push $1
  Push $2
  !insertmacro ComHlpr_CreateInProcInstance ${CLSID_ShellLink} ${IID_IShellLink} r0 ""
  ${If} $0 P<> 0
    ${IUnknown::QueryInterface} $0 '("${IID_IPersistFile}",.r1)'
    ${If} $1 P<> 0
      ${IPersistFile::Load} $1 '("$BastyonLnk",${STGM_READWRITE})'
      ${IShellLink::GetPath} $0 '(.r2,${NSIS_MAX_STRLEN},0,0)'
      ${If} $2 == "$BastyonOldDir\${MAINBINARYNAME}.exe"
        ${IShellLink::SetPath} $0 '("$INSTDIR\${MAINBINARYNAME}.exe")'
        ${IShellLink::SetWorkingDirectory} $0 '("$INSTDIR")'
        ${IPersistFile::Save} $1 '("$BastyonLnk",1)'
      ${EndIf}
      ${IUnknown::Release} $1 ""
    ${EndIf}
    ${IUnknown::Release} $0 ""
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

Function CreateOrUpdateStartMenuShortcut
  ; We used to use product name as MAINBINARYNAME
  ; migrate old shortcuts to target the new MAINBINARYNAME
  StrCpy $R0 0

  !insertmacro IsShortcutTarget "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\$OldMainBinaryName"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    StrCpy $R0 1
  ${EndIf}

  !insertmacro IsShortcutTarget "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\$OldMainBinaryName"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    StrCpy $R0 1
  ${EndIf}

  ${If} $R0 = 1
    Return
  ${EndIf}

  ; Skip creating shortcut if in update mode or no shortcut mode
  ; but always create if migrating from wix
  ${If} $WixMode = 0
    ${If} $UpdateMode = 1
    ${OrIf} $NoShortcutMode = 1
      Return
    ${EndIf}
  ${EndIf}

  !if "${STARTMENUFOLDER}" != ""
    CreateDirectory "$SMPROGRAMS\$AppStartMenuFolder"
    CreateShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
  !else
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  !endif
FunctionEnd

Function CreateOrUpdateDesktopShortcut
  ; We used to use product name as MAINBINARYNAME
  ; migrate old shortcuts to target the new MAINBINARYNAME
  !insertmacro IsShortcutTarget "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\$OldMainBinaryName"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Return
  ${EndIf}

  ; Skip creating shortcut if in update mode or no shortcut mode
  ; but always create if migrating from wix
  ${If} $WixMode = 0
    ${If} $UpdateMode = 1
    ${OrIf} $NoShortcutMode = 1
      Return
    ${EndIf}
  ${EndIf}

  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
FunctionEnd
