!macro customInit
  ; Backup user data before install overwrites it
  IfFileExists "$INSTDIR\resources\www\config.js" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\www\config.js" "$TEMP\canvasui_config_backup.js"

  IfFileExists "$INSTDIR\resources\www\media\*.*" 0 +2
    CreateDirectory "$TEMP\canvasui_media_backup"

  IfFileExists "$INSTDIR\resources\www\media" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\www\media\*.*" "$TEMP\canvasui_media_backup"
!macroend

!macro customInstall
  ; Restore user config if it was backed up
  IfFileExists "$TEMP\canvasui_config_backup.js" 0 +2
    CopyFiles /SILENT "$TEMP\canvasui_config_backup.js" "$INSTDIR\resources\www\config.js"
  Delete "$TEMP\canvasui_config_backup.js"

  ; Restore media folder
  IfFileExists "$TEMP\canvasui_media_backup\*.*" 0 +3
    CreateDirectory "$INSTDIR\resources\www\media"
    CopyFiles /SILENT "$TEMP\canvasui_media_backup\*.*" "$INSTDIR\resources\www\media"
  RMDir /r "$TEMP\canvasui_media_backup"

  ; Write a temp script to add to PATH, then execute it
  FileOpen $0 "$TEMP\canvasui_path.ps1" w
  FileWrite $0 '$$p = [Environment]::GetEnvironmentVariable("PATH", "User");'
  FileWrite $0 'if ($$p -notlike "*$INSTDIR*") {'
  FileWrite $0 '  [Environment]::SetEnvironmentVariable("PATH", "$$p;$INSTDIR", "User")'
  FileWrite $0 '}'
  FileClose $0
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -File "$TEMP\canvasui_path.ps1"'
  Delete "$TEMP\canvasui_path.ps1"
!macroend

!macro customUnInstall
  FileOpen $0 "$TEMP\canvasui_unpath.ps1" w
  FileWrite $0 '$$p = [Environment]::GetEnvironmentVariable("PATH", "User");'
  FileWrite $0 '$$p = ($$p.Split(";") | Where-Object { $$_ -ne "$INSTDIR" }) -join ";";'
  FileWrite $0 '[Environment]::SetEnvironmentVariable("PATH", $$p, "User")'
  FileClose $0
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -File "$TEMP\canvasui_unpath.ps1"'
  Delete "$TEMP\canvasui_unpath.ps1"
!macroend
