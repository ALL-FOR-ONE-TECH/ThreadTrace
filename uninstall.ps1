# ==============================================================================
# ThreadTrace - Windows Uninstaller
# Cleans up app installation while safely preserving project files & databases.
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$Force = $false
)

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  THREAD_TRACE // Windows Uninstaller" -ForegroundColor Yellow
Write-Host "  ALL-FOR-ONE-TECH (https://github.com/ALL-FOR-ONE-TECH/ThreadTrace)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow

# 1. Terminate running process
Write-Host "[1/4] Stopping any active ThreadTrace instances..." -ForegroundColor Cyan
Stop-Process -Name "ThreadTrace", "thread-trace" -Force -ErrorAction SilentlyContinue

# 2. Remove binary directory
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\ThreadTrace"
Write-Host "[2/4] Removing installed binaries from $InstallDir..." -ForegroundColor Cyan
if (Test-Path $InstallDir) {
    Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  -> Removed installation directory" -ForegroundColor Green
} else {
    Write-Host "  -> Installation directory already clean" -ForegroundColor Gray
}

# 3. Remove shortcuts
Write-Host "[3/4] Removing Start Menu & Desktop shortcuts..." -ForegroundColor Cyan
$DesktopFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$DesktopShortcut = Join-Path $DesktopFolder "ThreadTrace.lnk"
if (Test-Path $DesktopShortcut) {
    Remove-Item -Path $DesktopShortcut -Force -ErrorAction SilentlyContinue
    Write-Host "  -> Removed Desktop Shortcut" -ForegroundColor Green
}

$ProgramsFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
$StartMenuDir = Join-Path $ProgramsFolder "ThreadTrace"
if (Test-Path $StartMenuDir) {
    Remove-Item -Path $StartMenuDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  -> Removed Start Menu Shortcut" -ForegroundColor Green
}

# 4. Clean user PATH
Write-Host "[4/4] Cleaning user PATH variable..." -ForegroundColor Cyan
try {
    $UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
    if ($UserPath -like "*$InstallDir*") {
        $CleanedPath = ($UserPath.Split(';') | Where-Object { $_ -and $_ -ne $InstallDir }) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $CleanedPath, [EnvironmentVariableTarget]::User)
        Write-Host "  -> Cleaned PATH entry" -ForegroundColor Green
    }
} catch {
    # Non-fatal
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  ThreadTrace has been uninstalled successfully." -ForegroundColor Green
Write-Host "  Note: Your project code files and workspace databases remain safe." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Green
