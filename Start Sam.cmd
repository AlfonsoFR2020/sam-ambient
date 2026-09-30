@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 goto directory_error

if not exist ".venv\Scripts\sam-ambient.exe" goto environment_error

echo Starting Sam from this checkout...
".venv\Scripts\sam-ambient.exe"
set "sam_exit=%errorlevel%"
if not "%sam_exit%"=="0" (
    echo.
    echo Sam exited with error %sam_exit%. Review the messages above.
    pause
)
exit /b %sam_exit%

:directory_error
echo Could not open the Sam checkout directory.
pause
exit /b 1

:environment_error
echo Sam's source environment is not ready in this checkout.
echo Install Python 3.12+ and uv, then run "uv sync --locked" once here.
echo This launcher never installs or updates dependencies.
pause
exit /b 1
