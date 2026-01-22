@echo off
call %~dp0\local_npm\nodevars.bat
set PROMPT=(npm-env) %PROMPT%

::alias names for tools
DOSKEY run=npm run fbx_to_draco_glb

cmd /k