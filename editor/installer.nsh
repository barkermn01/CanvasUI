!macro customInit
  ; Backup user data before install overwrites it
  IfFileExists "$INSTDIR\resources\www\config.js" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\www\config.js" "$TEMP\canvasui_config_backup.js"

  IfFileExists "$INSTDIR\resources\www\media\*.*" 0 +2
    CreateDirectory "$TEMP\canvasui_media_backup"

  IfFileExists "$INSTDIR\resources\www\media" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\www\media\*.*" "$TEMP\canvasui_media_backup"

  ; Backup custom modules (any module not shipped with the installer)
  IfFileExists "$INSTDIR\resources\www\modules" 0 +3
    CreateDirectory "$TEMP\canvasui_modules_backup"
    nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -Command "& {$$dir = ''$INSTDIR\resources\www\modules''; $$mf = Join-Path $$dir ''modules.json''; if ((Test-Path $$dir) -and (Test-Path $$mf)) { $$builtIn = (Get-Content $$mf -Raw | ConvertFrom-Json).PSObject.Properties.Name; Get-ChildItem $$dir -Directory | Where-Object { $$builtIn -notcontains $$_.Name -and $$_.Name -ne ''.packages'' } | ForEach-Object { Copy-Item $$_.FullName ''$TEMP\canvasui_modules_backup\'' -Recurse -Force } } }"'
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

  ; Restore custom modules and update modules.json
  IfFileExists "$TEMP\canvasui_modules_backup" 0 +2
    nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -Command "& {$$bk = ''$TEMP\canvasui_modules_backup''; $$md = ''$INSTDIR\resources\www\modules''; if (Test-Path $$bk) { Get-ChildItem $$bk -Directory | ForEach-Object { Copy-Item $$_.FullName $$md -Recurse -Force }; $$mf = Join-Path $$md ''modules.json''; if (Test-Path $$mf) { $$j = Get-Content $$mf -Raw | ConvertFrom-Json; Get-ChildItem $$bk -Directory | ForEach-Object { if (-not ($$j.PSObject.Properties.Name -contains $$_.Name)) { $$ip = Join-Path $$md ($$_.Name + ''\info.json''); if (Test-Path $$ip) { $$j | Add-Member -NotePropertyName $$_.Name -NotePropertyValue ($$_.Name + ''/info.json'') } } }; $$j | ConvertTo-Json | Set-Content $$mf } } }"'
  RMDir /r "$TEMP\canvasui_modules_backup"

  ; Add to PATH
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -Command "& { $$instDir = ''$INSTDIR''; $$p = [Environment]::GetEnvironmentVariable(''PATH'',''User''); if ($$p -eq $$null) { $$p = '''' }; if ($$p -notlike (''*'' + $$instDir + ''*'')) { [Environment]::SetEnvironmentVariable(''PATH'',($$p + '';'' + $$instDir),''User'') } }"'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -Command "& { $$instDir = ''$INSTDIR''; $$p = [Environment]::GetEnvironmentVariable(''PATH'',''User''); if ($$p) { $$parts = $$p.Split('';'') | Where-Object { $$_ -ne $$instDir }; [Environment]::SetEnvironmentVariable(''PATH'',($$parts -join '';''),''User'') } }"'
!macroend
