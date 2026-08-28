$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$openCommand = Join-Path $repositoryRoot "Abrir-T3-Code-Scroll.cmd"
$updateCommand = Join-Path $repositoryRoot "Update-T3-Code-Scroll.cmd"

foreach ($requiredFile in @($openCommand, $updateCommand)) {
  if (-not (Test-Path -LiteralPath $requiredFile)) {
    throw "Shortcut target was not found: $requiredFile"
  }
}

$shell = New-Object -ComObject WScript.Shell
$desktopDirectory = $shell.SpecialFolders.Item("Desktop")
$startMenuDirectory = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"

function Set-Shortcut {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Target
  )

  $shortcut = $shell.CreateShortcut($Path)
  $shortcut.TargetPath = $Target
  $shortcut.WorkingDirectory = $repositoryRoot
  $shortcut.Save()
}

Set-Shortcut `
  -Path (Join-Path $desktopDirectory "Abrir T3 Code Scroll.lnk") `
  -Target $openCommand
Set-Shortcut `
  -Path (Join-Path $desktopDirectory "Actualizar T3 Code Scroll.lnk") `
  -Target $updateCommand
Set-Shortcut `
  -Path (Join-Path $startMenuDirectory "T3 Code Scroll.lnk") `
  -Target $openCommand
