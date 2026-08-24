@echo off
setlocal
set "TARGET_DIR=%~f1"
if "%~1"=="" set "TARGET_DIR=%CD%"

if exist "%LOCALAPPDATA%\Programs\ThreadTrace\ThreadTrace.exe" (
    start "" "%LOCALAPPDATA%\Programs\ThreadTrace\ThreadTrace.exe" "%TARGET_DIR%"
    goto :eof
)
if exist "%ProgramFiles%\ThreadTrace\ThreadTrace.exe" (
    start "" "%ProgramFiles%\ThreadTrace\ThreadTrace.exe" "%TARGET_DIR%"
    goto :eof
)
if exist "%~dp0ThreadTrace.exe" (
    start "" "%~dp0ThreadTrace.exe" "%TARGET_DIR%"
    goto :eof
)
if exist "X:\Code-Board\ThreadTrace.exe" (
    start "" "X:\Code-Board\ThreadTrace.exe" "%TARGET_DIR%"
    goto :eof
)


echo [ThreadTrace] Could not find ThreadTrace.exe.
pause

