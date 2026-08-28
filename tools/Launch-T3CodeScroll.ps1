$ErrorActionPreference = "Stop"

$official = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -like "T3 Code (*).exe" -and $_.ExecutablePath -like "*\Programs\t3code\*"
}

if ($official) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "T3 Code oficial sigue abierto.`n`nCiérralo completamente y vuelve a abrir este acceso directo. No se copiará ni perderá ningún dato.",
    "Abrir T3 Code Scroll",
    [System.Windows.MessageBoxButton]::OK,
    [System.Windows.MessageBoxImage]::Information
  ) | Out-Null
  exit 2
}

$customExecutable = Join-Path $env:LOCALAPPDATA "Programs\t3code-scroll\t3code-scroll.exe"
if (-not (Test-Path -LiteralPath $customExecutable)) {
  throw "T3 Code Scroll is not installed at $customExecutable"
}

Start-Process -FilePath $customExecutable
