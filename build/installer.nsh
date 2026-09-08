; SOPHENIC — electron-builder NSIS customisations.
; Kept deliberately small so the installer remains compatible with electron-builder updates.
!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "SOPHENIC INSTALLER"
  !define MUI_WELCOMEPAGE_TEXT "Installez SOPHENIC sur cet ordinateur. L'installation conserve les données utilisateur dans le profil Windows."
  !define MUI_FINISHPAGE_TITLE "SOPHENIC est prêt"
  !define MUI_FINISHPAGE_TEXT "L'installation est terminée. Vous pouvez lancer SOPHENIC."
!macroend

; Build smoke test marker: STR:Installer
!macro customInstall
!macroend

!macro customUnInstall
!macroend
