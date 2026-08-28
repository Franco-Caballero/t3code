[CmdletBinding()]
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$upstreamUrl = "https://github.com/pingdotgg/t3code.git"

Set-Location -LiteralPath $repositoryRoot

if ((git status --porcelain).Length -ne 0) {
  throw "The T3 Code Scroll source has uncommitted changes. Finish or discard them before updating."
}

$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne "scroll-memory") {
  throw "Expected branch 'scroll-memory', but found '$currentBranch'."
}

$upstreamRemote = git remote get-url upstream 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add upstream $upstreamUrl
} elseif ($upstreamRemote.Trim() -ne $upstreamUrl) {
  throw "The 'upstream' remote points to '$upstreamRemote', not official T3 Code."
}

Write-Host "Fetching official T3 Code updates..."
git fetch upstream main --tags --prune
if ($LASTEXITCODE -ne 0) { throw "Could not fetch official T3 Code." }

Write-Host "Merging official updates into T3 Code Scroll..."
git merge --no-edit upstream/main
if ($LASTEXITCODE -ne 0) {
  throw "The update has a merge conflict. Nothing was installed; ask Codex to resolve it."
}

Write-Host "Installing exact dependencies..."
vp i --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }

Write-Host "Running focused safety checks..."
vp run --filter @t3tools/web typecheck
if ($LASTEXITCODE -ne 0) { throw "Web typecheck failed." }
vp run --filter @t3tools/desktop typecheck
if ($LASTEXITCODE -ne 0) { throw "Desktop typecheck failed." }
vp test run src/components/chat/threadReadingPosition.test.ts src/components/chat/MessagesTimeline.test.tsx src/components/chat/MessagesTimeline.logic.test.ts --project unit --root apps/web
if ($LASTEXITCODE -ne 0) { throw "Scroll-memory tests failed." }

Write-Host "Building the optimized Windows app..."
$officialWslPrebuild = Join-Path $env:LOCALAPPDATA "Programs\t3code\resources\server.asar.unpacked\node_modules\node-pty\prebuilds\linux-x64\pty.node"
$buildArguments = @(
  "scripts/build-desktop-artifact.ts",
  "--platform", "win",
  "--target", "nsis",
  "--arch", "x64"
)
if (Test-Path -LiteralPath $officialWslPrebuild) {
  $buildArguments += @("--wsl-prebuild", $officialWslPrebuild)
} else {
  Write-Warning "The official WSL prebuild was not found. The Windows backend will work, but WSL support will be omitted from this package."
}
node @buildArguments
if ($LASTEXITCODE -ne 0) { throw "Windows packaging failed." }

$installer = Get-ChildItem -LiteralPath (Join-Path $repositoryRoot "release") -File -Recurse |
  Where-Object { $_.Name -like "T3-Code-Scroll-*-x64.exe" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $installer) {
  throw "The build completed but the T3 Code Scroll installer was not found."
}

if ($SkipInstall) {
  Write-Host "Installer ready: $($installer.FullName)"
  exit 0
}

$runningT3Apps = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.ExecutablePath -like "*\Programs\t3code-scroll\*" -or
  ($_.Name -like "T3 Code (*).exe" -and $_.ExecutablePath -like "*\Programs\t3code\*")
}
if ($runningT3Apps) {
  throw "Close both official T3 Code and T3 Code Scroll, then run this updater again. The installer is ready at $($installer.FullName)."
}

Write-Host "Installing T3 Code Scroll without changing the official T3 Code installation..."
$installerProcess = Start-Process -FilePath $installer.FullName -ArgumentList "/S" -Wait -PassThru
if ($installerProcess.ExitCode -ne 0) {
  throw "The installer exited with code $($installerProcess.ExitCode)."
}

& (Join-Path $PSScriptRoot "Set-T3CodeScrollShortcuts.ps1")
Write-Host "T3 Code Scroll is up to date and installed. Close official T3 Code before opening it."
