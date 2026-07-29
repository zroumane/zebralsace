@echo off
rem Poste d'impression d'étiquettes — démarrage Windows.
rem Lancement automatique : Planificateur de tâches -> « Au démarrage »
rem (ou NSSM https://nssm.cc pour un vrai service Windows).
cd /d "%~dp0.."
set PORT=3000
call npm run start
