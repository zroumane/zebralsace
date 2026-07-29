@echo off
rem Sauvegarde data\ (base SQLite + logos) avec rétention de 30 sauvegardes (Windows).
rem À planifier, par ex. tous les jours à 3 h :
rem   schtasks /create /tn "Zebralsace sauvegarde" /sc daily /st 03:00 ^
rem     /tr "\"%~f0\"" /ru SYSTEM
setlocal enabledelayedexpansion
cd /d "%~dp0.."

if "%DATA_DIR%"=="" set DATA_DIR=.\data
set DEST=%~1
if "%DEST%"=="" set DEST=.\sauvegardes

rem horodatage AAAA-MM-JJ_HH-MM-SS, indépendant du format de date régional
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set HORODATAGE=%%t
set CIBLE=%DEST%\%HORODATAGE%
mkdir "%CIBLE%" || exit /b 1

rem Copie cohérente de la base via l'API de sauvegarde SQLite (sûre même en cours d'écriture)
node -e "require('better-sqlite3')(process.env.DATA_DIR + '/zebra.db').backup(process.env.CIBLE + '/zebra.db').then(()=>process.exit(0))" || exit /b 1
if exist "%DATA_DIR%\logos" xcopy /e /i /q /y "%DATA_DIR%\logos" "%CIBLE%\logos" >nul

rem Rétention : ne garde que les 30 plus récentes (tri alphabétique = chronologique)
set N=0
for /f "delims=" %%d in ('dir /b /ad /o-n "%DEST%"') do (
  set /a N+=1
  if !N! gtr 30 rd /s /q "%DEST%\%%d"
)

echo Sauvegarde ecrite dans %CIBLE%
