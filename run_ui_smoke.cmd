@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0run_ui_smoke.ps1" %*
exit /b %ERRORLEVEL%
