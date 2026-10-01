@echo off
setlocal
rem Offline probe only. Uses installed Build Tools/SDK; never installs anything.
set "sam_vswhere=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%sam_vswhere%" (
  echo Installed Visual Studio C++ Build Tools are required for this optional probe.
  exit /b 1
)
for /f "usebackq tokens=*" %%i in (`"%sam_vswhere%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "sam_vsroot=%%i"
if not defined sam_vsroot (
  echo No installed C++ toolchain found. No dependency was installed.
  exit /b 1
)
call "%sam_vsroot%\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1
cd /d "%~dp0..\.."
if not exist ".sam\windows-aec" mkdir ".sam\windows-aec"
cd /d ".sam\windows-aec"
cl /nologo /std:c++17 /EHsc /W4 /WX /O2 /LD /MD ..\..\scripts\native\windows_aec_probe.cpp /link /OUT:sam_windows_aec.dll ole32.lib uuid.lib strmiids.lib msdmo.lib wmcodecdspuuid.lib
exit /b %errorlevel%
