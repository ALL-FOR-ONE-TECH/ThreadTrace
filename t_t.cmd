@echo off
rem ThreadTrace CLI Launcher (t_t)
if "%~1"=="" (
    start "" "%~dp0ThreadTrace.exe"
) else (
    start "" "%~dp0ThreadTrace.exe" "%~f1"
)
