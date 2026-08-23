# ==============================================================================
# ThreadTrace - Windows Dynamic Installer
# Spatial Code Investigation Canvas & Low-Memory Evidence Board
# Powered by ALL-FOR-ONE-TECH (https://github.com/ALL-FOR-ONE-TECH/ThreadTrace)
# License: MIT Open Source
# ==============================================================================

[CmdletBinding()]
param(
    [string]$Version = "latest",
    [switch]$Portable = $false,
    [switch]$NoLaunch = $false
)

$ErrorActionPreference = "Stop"
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {
    # Ignore if TLS13 not supported in older runtime
}

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  THREAD_TRACE // Windows Native Installer" -ForegroundColor Yellow
Write-Host "  Organization: ALL-FOR-ONE-TECH" -ForegroundColor Yellow
Write-Host "  License: MIT Open Source" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow

$Repo = "ALL-FOR-ONE-TECH/ThreadTrace"
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\ThreadTrace"
$ExePath = Join-Path $InstallDir "ThreadTrace.exe"

# 1. Query GitHub API dynamically for latest release
Write-Host "[1/5] Resolving latest ThreadTrace release from GitHub..." -ForegroundColor Cyan

$DownloadUrl = ""
$ReleaseTag = ""

try {
    $ApiUrl = if ($Version -eq "latest") {
        "https://api.github.com/repos/$Repo/releases/latest"
    } else {
        "https://api.github.com/repos/$Repo/releases/tags/$Version"
    }

    $Headers = @{
        "User-Agent" = "ThreadTrace-Installer/1.0"
        "Accept"     = "application/vnd.github.v3+json"
    }

    $ReleaseInfo = Invoke-RestMethod -Uri $ApiUrl -Headers $Headers -TimeoutSec 15
    if ($ReleaseInfo.tag_name) {
        $ReleaseTag = $ReleaseInfo.tag_name
        Write-Host "  -> Found release: $ReleaseTag" -ForegroundColor Green
    }

    if ($ReleaseInfo.assets) {
        $TargetAsset = $ReleaseInfo.assets | Where-Object { $_.name -like "*ThreadTrace.exe" -or $_.name -like "*ThreadTrace*Setup*.exe" } | Select-Object -First 1
        if ($TargetAsset -and $TargetAsset.browser_download_url) {
            $DownloadUrl = $TargetAsset.browser_download_url
        }
    }
} catch {
    Write-Host "  -> Notice: Using direct release asset fallback..." -ForegroundColor Gray
}

# Fallback to direct latest release asset if API parsing did not find URL
if (-not $DownloadUrl) {
    $DownloadUrl = "https://github.com/$Repo/releases/latest/download/ThreadTrace.exe"
}

# 2. Create destination directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# 3. Download binary
Write-Host "[2/5] Downloading ThreadTrace executable..." -ForegroundColor Cyan
Write-Host "  Source: $DownloadUrl" -ForegroundColor Gray

$TempDownload = Join-Path $env:TEMP "ThreadTrace_Download.exe"
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempDownload -UseBasicParsing
} catch {
    Write-Host "ERROR: Failed to download ThreadTrace: $_" -ForegroundColor Red
    exit 1
}

# 4. Safe deployment and Antivirus / Mark of the Web unblocking
Write-Host "[3/5] Deploying and unblocking executable..." -ForegroundColor Cyan
try {
    Unblock-File -Path $TempDownload -ErrorAction SilentlyContinue
    Move-Item -Path $TempDownload -Destination $ExePath -Force
    Unblock-File -Path $ExePath -ErrorAction SilentlyContinue
    Write-Host "  -> Installed to: $ExePath" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to deploy executable: $_" -ForegroundColor Red
    exit 1
}

# 5. Create Desktop and Start Menu Shortcuts
Write-Host "[4/5] Creating Desktop and Start Menu shortcuts..." -ForegroundColor Cyan
try {
    $WshShell = New-Object -ComObject WScript.Shell

    # Desktop shortcut
    $DesktopFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    $DesktopShortcutPath = Join-Path $DesktopFolder "ThreadTrace.lnk"
    $DesktopShortcut = $WshShell.CreateShortcut($DesktopShortcutPath)
    $DesktopShortcut.TargetPath = $ExePath
    $DesktopShortcut.WorkingDirectory = $InstallDir
    $DesktopShortcut.Description = "ThreadTrace: Spatial Code Investigation Canvas"
    $DesktopShortcut.Save()
    Write-Host "  -> Created Desktop Shortcut" -ForegroundColor Green

    # Start Menu shortcut
    $ProgramsFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
    $StartMenuDir = Join-Path $ProgramsFolder "ThreadTrace"
    if (-not (Test-Path $StartMenuDir)) {
        New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
    }
    $StartShortcutPath = Join-Path $StartMenuDir "ThreadTrace.lnk"
    $StartShortcut = $WshShell.CreateShortcut($StartShortcutPath)
    $StartShortcut.TargetPath = $ExePath
    $StartShortcut.WorkingDirectory = $InstallDir
    $StartShortcut.Description = "ThreadTrace: Spatial Code Investigation Canvas"
    $StartShortcut.Save()
    Write-Host "  -> Created Start Menu Shortcut" -ForegroundColor Green
} catch {
    Write-Host "  -> Notice: Shortcut creation skipped (launch directly from $ExePath)" -ForegroundColor Yellow
}

# 6. Add to user PATH if not present
Write-Host "[5/5] Checking User PATH configuration..." -ForegroundColor Cyan
try {
    $UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
    if ($UserPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", [EnvironmentVariableTarget]::User)
        Write-Host "  -> Added to User PATH" -ForegroundColor Green
    } else {
        Write-Host "  -> PATH already configured" -ForegroundColor Gray
    }
} catch {
    # Non-fatal
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "  Launch via Desktop shortcut or command: ThreadTrace" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

if (-not $NoLaunch) {
    Write-Host "Launching ThreadTrace..." -ForegroundColor Cyan
    Start-Process -FilePath $ExePath
}
