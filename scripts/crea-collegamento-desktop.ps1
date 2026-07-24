<#
  Crea un collegamento sul Desktop all'eseguibile generato da "npm run pack:exe".
  Cerca automaticamente LabelForge.exe dentro dist-app\.
  Uso: doppio clic su "Crea collegamento Desktop.bat" (che richiama questo script).
#>
$ErrorActionPreference = "Stop"

# Radice progetto = cartella superiore a scripts\
$root = Split-Path -Parent $PSScriptRoot
$exeName = "LabelForge.exe"

$exe = Get-ChildItem -Path (Join-Path $root "dist-app") -Recurse -Filter $exeName -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $exe) {
  Write-Host "Eseguibile non trovato in dist-app\. Esegui prima:  npm run pack:exe" -ForegroundColor Yellow
  Read-Host "Premi Invio per chiudere"
  exit 1
}

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "LabelForge.lnk"

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnkPath)
$sc.TargetPath = $exe.FullName
$sc.WorkingDirectory = $exe.DirectoryName
$sc.IconLocation = "$($exe.FullName),0"
$sc.Description = "Stampa etichette Zebra ZD410"
$sc.Save()

Write-Host "Collegamento creato sul Desktop:" -ForegroundColor Green
Write-Host "  $lnkPath"
Write-Host "  -> $($exe.FullName)"
Read-Host "Premi Invio per chiudere"
