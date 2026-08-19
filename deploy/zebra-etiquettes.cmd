@echo off
rem Poste d'impression d'étiquettes — démarrage Windows.
rem Installé en démarrage automatique par deploy\installer.cmd (tâche planifiée
rem « Zebralsace », compte SYSTEM). Alternative : NSSM (https://nssm.cc).
cd /d "%~dp0.."
set PORT=3000
if not exist logs mkdir logs

:boucle
echo ===== demarrage %date% %time% ===== >> logs\app.log
call npm run start >> logs\app.log 2>&1
echo ===== arret %date% %time% (code %errorlevel%) ===== >> logs\app.log
rem l'application s'est arrêtée : on la relance (équivalent du Restart=always
rem de systemd), avec une courte pause pour éviter une boucle folle
timeout /t 3 /nobreak >nul
goto boucle
