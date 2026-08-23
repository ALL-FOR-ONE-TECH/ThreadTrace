# ==============================================================================
# ThreadTrace - Windows Dynamic Installer
# Spatial Code Investigation Canvas & Low-Memory Evidence Board
# Powered by ALL-FOR-ONE-TECH (https://github.com/ALL-FOR-ONE-TECH/ThreadTrace)
# License: MIT Open Source
# ==============================================================================

if (-not (Get-Variable -Name "Version" -Scope Global -ErrorAction SilentlyContinue)) { $Version = "latest" }
if (-not (Get-Variable -Name "Portable" -Scope Global -ErrorAction SilentlyContinue)) { $Portable = $false }
if (-not (Get-Variable -Name "NoLaunch" -Scope Global -ErrorAction SilentlyContinue)) { $NoLaunch = $false }


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

# 1. Ensure Microsoft Edge WebView2 is available
Write-Host "[1/5] Checking WebView2 runtime dependency..." -ForegroundColor Cyan
$wv2Reg = (Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-234A-4265-A242-9E07E1F686F7}" -ErrorAction SilentlyContinue) -or `
          (Get-ItemProperty -Path "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-234A-4265-A242-9E07E1F686F7}" -ErrorAction SilentlyContinue) -or `
          (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-234A-4265-A242-9E07E1F686F7}" -ErrorAction SilentlyContinue)

if (-not $wv2Reg) {
    Write-Host "  -> WebView2 not detected. Downloading Evergreen Bootstrapper..." -ForegroundColor Yellow
    try {
        $wvTemp = Join-Path $env:TEMP "MicrosoftEdgeWebview2Setup.exe"
        Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $wvTemp -UseBasicParsing
        Unblock-File -Path $wvTemp -ErrorAction SilentlyContinue
        Start-Process -FilePath $wvTemp -ArgumentList "/silent /install" -Wait
        Write-Host "  -> WebView2 installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "  -> Notice: Could not auto-install WebView2. Continuing installation..." -ForegroundColor Gray
    }
} else {
    Write-Host "  -> WebView2 Runtime is active" -ForegroundColor Green
}

# 2. Query GitHub API dynamically for latest release
Write-Host "[2/5] Resolving latest ThreadTrace release from GitHub..." -ForegroundColor Cyan

$DownloadUrl = ""
$IsSetupInstaller = $false
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
        # Prefer standalone portable ThreadTrace.exe if available or setup installer
        $PortableAsset = $ReleaseInfo.assets | Where-Object { $_.name -eq "ThreadTrace.exe" } | Select-Object -First 1
        $SetupAsset = $ReleaseInfo.assets | Where-Object { $_.name -like "*setup*.exe" -or $_.name -like "*Setup*.exe" } | Select-Object -First 1

        if ($PortableAsset -and -not $IsSetupInstaller) {
            $DownloadUrl = $PortableAsset.browser_download_url
            $IsSetupInstaller = $false
        } elseif ($SetupAsset) {
            $DownloadUrl = $SetupAsset.browser_download_url
            $IsSetupInstaller = $true
        }
    }
} catch {
    Write-Host "  -> Notice: Using direct release asset fallback..." -ForegroundColor Gray
}

# Fallback to direct latest release asset if API parsing did not find URL
if (-not $DownloadUrl) {
    $DownloadUrl = "https://github.com/$Repo/releases/latest/download/ThreadTrace.exe"
}

# 3. Download binary/installer
Write-Host "[3/5] Downloading ThreadTrace..." -ForegroundColor Cyan
Write-Host "  Source: $DownloadUrl" -ForegroundColor Gray

$TempDownload = Join-Path $env:TEMP "ThreadTrace_Package.exe"
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $TempDownload -UseBasicParsing
    Unblock-File -Path $TempDownload -ErrorAction SilentlyContinue
} catch {
    Write-Host "ERROR: Failed to download ThreadTrace: $_" -ForegroundColor Red
    exit 1
}

# 4. Deploy or run installer
Write-Host "[4/5] Deploying ThreadTrace..." -ForegroundColor Cyan

if ($IsSetupInstaller) {
    Write-Host "  -> Launching Setup Installer..." -ForegroundColor Cyan
    Start-Process -FilePath $TempDownload -Wait
} else {
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    Move-Item -Path $TempDownload -Destination $ExePath -Force
    Unblock-File -Path $ExePath -ErrorAction SilentlyContinue
    Write-Host "  -> Installed standalone binary to: $ExePath" -ForegroundColor Green

    # Create Desktop and Start Menu Shortcuts
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

    # Add to user PATH
    try {
        $UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
        if ($UserPath -notlike "*$InstallDir*") {
            [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", [EnvironmentVariableTarget]::User)
            Write-Host "  -> Added to User PATH" -ForegroundColor Green
        }
    } catch {
        # Non-fatal
    }
}

# 5. Completion
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

if (-not $NoLaunch -and -not $IsSetupInstaller -and (Test-Path $ExePath)) {
    Write-Host "Launching ThreadTrace..." -ForegroundColor Cyan
    Start-Process -FilePath $ExePath
}
