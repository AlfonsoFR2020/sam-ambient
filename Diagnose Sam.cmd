@echo off
rem Shared startup; diagnostic mode keeps the console available after exit.
call "%~dp0Start Sam.cmd" --diagnostic %*
exit /b %errorlevel%
