@echo off
setlocal
title Repositorio Aplicacao
set "APP_NAME=Repositorio Aplicacao"
set "PORT=3000"
set "API_PORT=3000"
set "WEB_PORT=5190"
npm run dev
if errorlevel 1 pause
endlocal
