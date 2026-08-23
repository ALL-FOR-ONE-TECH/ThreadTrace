@echo off
rem ThreadTrace CLI Launcher (tt)
if "%~1"=="" (
    start "" "%~dp0ThreadTrace.exe"
) else (
    start "" "%~dp0ThreadTrace.exe" "%~f1"
)
