$ErrorActionPreference = "Stop"

$official = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -like "T3 Code (*).exe" -and $_.ExecutablePath -like "*\Programs\t3code\*"
}

if ($official) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    "T3 Code oficial sigue abierto.`n`nCierralo completamente y vuelve a abrir este acceso directo. No se copiara ni perdera ningun dato.",
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

$sharedT3Home = Join-Path $env:USERPROFILE ".t3"
$sharedElectronProfile = Join-Path $env:APPDATA "t3code"
$sharedDatabase = Join-Path $sharedT3Home "userdata\state.sqlite"

if (-not (Test-Path -LiteralPath $sharedDatabase)) {
  throw "The shared T3 Code database was not found at $sharedDatabase"
}

# T3CODE_HOME selects the server data (threads, settings, environments).
# --user-data-dir must be present on Electron's initial command line so
# safeStorage loads the same encryption key as official T3 Code before any
# application JavaScript runs. Setting app.setPath later is too late for that
# key on Windows and makes the encrypted project catalog appear empty.
$env:T3CODE_HOME = $sharedT3Home
Start-Process -FilePath $customExecutable -ArgumentList @(
  "--user-data-dir=$sharedElectronProfile"
)
