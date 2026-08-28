[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [int]$OfficialProcessId,
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [Parameter(Mandatory = $true)]
  [string]$LogPath
)

$ErrorActionPreference = "Stop"

function Write-TransitionLog([string]$Message) {
  Add-Content -LiteralPath $LogPath -Value "$(Get-Date -Format o) $Message"
}

try {
  Write-TransitionLog "Waiting for official T3 Code process $OfficialProcessId to exit."
  Wait-Process -Id $OfficialProcessId -Timeout 120 -ErrorAction SilentlyContinue
  if (Get-Process -Id $OfficialProcessId -ErrorAction SilentlyContinue) {
    throw "Official T3 Code did not close within 120 seconds."
  }

  Write-TransitionLog "Installing T3 Code Scroll from $InstallerPath."
  $install = Start-Process -FilePath $InstallerPath -ArgumentList "/S" -Wait -PassThru
  if ($install.ExitCode -ne 0) {
    throw "Installer exited with code $($install.ExitCode)."
  }

  $customExecutable = Join-Path $env:LOCALAPPDATA "Programs\t3code-scroll\t3code-scroll.exe"
  if (-not (Test-Path -LiteralPath $customExecutable)) {
    throw "T3 Code Scroll installed, but its executable could not be found."
  }

  $shortcutScript = Join-Path $PSScriptRoot "Set-T3CodeScrollShortcuts.ps1"
  $launchScript = Join-Path $PSScriptRoot "Launch-T3CodeScroll.ps1"
  & $shortcutScript
  Write-TransitionLog "Launching through the shared-profile launcher."
  & $launchScript
  Write-TransitionLog "Transition complete."
} catch {
  Write-TransitionLog "Transition failed: $($_.Exception.Message)"
  $officialExecutable = Join-Path $env:LOCALAPPDATA "Programs\t3code\T3 Code (Nightly).exe"
  if (Test-Path -LiteralPath $officialExecutable) {
    Write-TransitionLog "Reopening official T3 Code as fallback."
    Start-Process -FilePath $officialExecutable
  }
  exit 1
}
