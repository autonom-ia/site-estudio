@echo off
rem Site Estudio: ponto de entrada do kit no Windows (PowerShell ou Prompt de Comando).
rem Uso: .\estudio.cmd <comando> [argumentos]
rem Usa o Node da pasta .ferramentas (posto pelo instalador); sem ele, o Node do sistema.
rem A ultima linha da saida e sempre um JSON numa linha so. Sem Node, o JSON de erro nao repete
rem o que foi digitado (um argumento com aspas ou & quebraria o JSON).
setlocal EnableExtensions DisableDelayedExpansion

set "ESTUDIO_REPO=%~dp0"
if "%ESTUDIO_REPO:~-1%"=="\" set "ESTUDIO_REPO=%ESTUDIO_REPO:~0,-1%"
if not defined ESTUDIO_FERRAMENTAS set "ESTUDIO_FERRAMENTAS=%ESTUDIO_REPO%\.ferramentas"

set "PATH=%ESTUDIO_FERRAMENTAS%\bin;%ESTUDIO_FERRAMENTAS%\node;%PATH%"
rem Quem ja escolheu um Node (ESTUDIO_NODE apontando para um arquivo que existe) manda.
if defined ESTUDIO_NODE if not exist "%ESTUDIO_NODE%" set "ESTUDIO_NODE="
if not defined ESTUDIO_NODE set "ESTUDIO_NODE=%ESTUDIO_FERRAMENTAS%\node\node.exe"
set "npm_config_cache=%ESTUDIO_FERRAMENTAS%\cache\npm"
set "npm_config_update_notifier=false"
set "npm_config_fund=false"
set "npm_config_audit=false"

if exist "%ESTUDIO_NODE%" goto rodar
where node >nul 2>nul
if errorlevel 1 goto semnode
set "ESTUDIO_NODE=node"
goto rodar

:semnode
echo {"ok":false,"comando":"","codigo":"ESTUDIO_NAO_INSTALADO","resumo":"O estudio ainda nao terminou de instalar: falta o Node.","arquivos":{},"avisos":[],"dados":{}}
exit /b 1

:rodar
rem Uma linha so, terminando em "& exit /b": o "atualizar" reescreve este arquivo enquanto o
rem cmd.exe o le linha a linha; com a saida na mesma linha, nada do arquivo novo e lido.
rem "exit /b" sem numero devolve o ERRORLEVEL do Node.
"%ESTUDIO_NODE%" "%ESTUDIO_REPO%\kit\scripts\estudio.mjs" %* & exit /b
