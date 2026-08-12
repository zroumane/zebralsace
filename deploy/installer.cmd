@echo off
rem Installation Windows : dependances, build, demarrage automatique.
rem A lancer en tant qu'ADMINISTRATEUR depuis le dossier du depot :
rem   deploy\installer.cmd
cd /d "%~dp0.."

net session >nul 2>&1 || (echo Lancez ce script en tant qu'administrateur. & pause & exit /b 1)
where node >nul 2>&1 || (echo Node.js 22+ requis - https://nodejs.org & pause & exit /b 1)

echo Installation des dependances et build...
call npm ci || (pause & exit /b 1)
call npm run build || (pause & exit /b 1)

rem Tache planifiee : demarre avec la machine (compte SYSTEM, sans session
rem ouverte). Le script de demarrage relance l'application si elle s'arrete.
schtasks /create /f /tn "Zebralsace" /tr "\"%CD%\deploy\zebra-etiquettes.cmd\"" /sc onstart /ru SYSTEM /rl HIGHEST || (pause & exit /b 1)
schtasks /run /tn "Zebralsace" >nul

timeout /t 5 /nobreak >nul
curl -s http://localhost:3000/api/ping && echo  ^<- l'application repond sur le port 3000
echo.
echo Installation terminee. La tache "Zebralsace" demarre avec la machine.
echo Redemarrage manuel : schtasks /end /tn Zebralsace ^&^& schtasks /run /tn Zebralsace
echo Alternative "vrai service" Windows : NSSM (https://nssm.cc).
pause
