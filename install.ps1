# ThreadTrace Windows One-Click Installer
# Powered by ALL-FOR-ONE-TECH (https://github.com/ALL-FOR-ONE-TECH/ThreadTrace)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  🕵️‍♂️ THREAD_TRACE // Spatial Code Investigation Canvas" -ForegroundColor Yellow
Write-Host "  Organization: ALL-FOR-ONE-TECH" -ForegroundColor DarkGray
Write-Host "============================================================" -ForegroundColor Cyan

$repo = "ALL-FOR-ONE-TECH/ThreadTrace"
$installDir = "$HOME\AppData\Local\Programs\ThreadTrace"
$desktopDir = [Environment]::GetFolderPath("Desktop")

if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

Write-Host "`n[1/3] Fetching latest release binary from GitHub..." -ForegroundColor Green
$exeUrl = "https://github.com/$repo/releases/latest/download/ThreadTrace.exe"
$targetExe = "$installDir\ThreadTrace.exe"

try {
    Invoke-WebRequest -Uri $exeUrl -OutFile $targetExe -UseBasicParsing
    Write-Host "[✓] Downloaded ThreadTrace.exe successfully." -ForegroundColor Green
} catch {
    Write-Host "[!] Could not fetch from releases yet, downloading standalone binary..." -ForegroundColor Yellow
    $fallbackUrl = "https://raw.githubusercontent.com/$repo/main/ThreadTrace.exe"
    Invoke-WebRequest -Uri $fallbackUrl -OutFile $targetExe -UseBasicParsing
}

Write-Host "`n[2/3] Creating Desktop Shortcut..." -ForegroundColor Green
$shortcutPath = "$desktopDir\ThreadTrace.lnk"
$wshell = New-Object -ComObject WScript.Shell
$shortcut = $wshell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetExe
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = "ThreadTrace: Spatial Code Investigation Canvas"
$shortcut.Save()

Write-Host "[✓] Desktop shortcut created at $shortcutPath" -ForegroundColor Green

Write-Host "`n[3/3] Installation Complete!" -ForegroundColor Cyan
Write-Host "Launching ThreadTrace now..." -ForegroundColor Yellow
Start-Process -FilePath $targetExe
