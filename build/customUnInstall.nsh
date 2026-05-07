!macro customUnInstall
  ; Remove app userData directory on uninstall
  RMDir /r "$APPDATA\my-qhub"
!macroend
