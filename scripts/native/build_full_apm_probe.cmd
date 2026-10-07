@echo off
setlocal
rem Compile only Sam's shim against a separately hash-verified full APM package.
rem No downloads, upstream edits, dependency installs or global changes.
set "sam_vswhere=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%sam_vswhere%" exit /b 1
for /f "usebackq tokens=*" %%i in (`"%sam_vswhere%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "sam_vsroot=%%i"
if not defined sam_vsroot exit /b 1
call "%sam_vsroot%\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 exit /b 1
cd /d "%~dp0..\.."
set "sam_apm_package=%CD%\.sam\full-apm\package"
if not exist "%sam_apm_package%\lib\webrtc-audio-processing-3.lib" (
  echo Missing verified full APM package; see docs\AEC_FULL_APM_GATE_2026-10-07.md.
  exit /b 1
)
cd /d ".sam\full-apm"
cl /nologo /std:c++20 /EHsc /W4 /WX /wd4068 /O2 /LD /MD /DWEBRTC_WIN /DWEBRTC_ENABLE_SYMBOL_EXPORT /external:W0 /external:I"%sam_apm_package%\include" /external:I"%sam_apm_package%\include\webrtc-audio-processing-3" ..\..\scripts\native\full_apm_probe.cpp /link "%sam_apm_package%\lib\webrtc-audio-processing-3.lib" /OUT:sam_full_apm.dll
exit /b %errorlevel%
