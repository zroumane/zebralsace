@echo off
rem Met à jour l'application depuis GitHub (Windows).
rem Premier lancement : génère une clé de déploiement (deploy\cle-deploiement,
rem gitignorée) à ajouter dans GitHub -> Settings -> Deploy keys (lecture seule).
cd /d "%~dp0.."

if not exist deploy\cle-deploiement (
  ssh-keygen -t ed25519 -N "" -C "deploiement-etiquettes-%COMPUTERNAME%" -f deploy\cle-deploiement
  echo.
  echo Cle de deploiement generee. Ajoutez la cle PUBLIQUE ci-dessous au depot
  echo GitHub : Settings ^> Deploy keys ^> Add deploy key ^(lecture seule^) :
  echo.
  type deploy\cle-deploiement.pub
  echo.
  echo Puis relancez ce script.
  pause
  exit /b 0
)

set GIT_SSH_COMMAND=ssh -i deploy/cle-deploiement -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new
echo Recuperation de la derniere version...
git fetch --tags --force origin || (pause & exit /b 1)
rem Les machines clientes suivent la derniere version TAGUEE ; sans tag, repli sur main.
set TAG=
for /f "delims=" %%t in ('git tag --sort=-v:refname') do if not defined TAG set TAG=%%t
if defined TAG (
  echo Passage a la version %TAG%
  git checkout -q %TAG% || (pause & exit /b 1)
) else (
  git pull --ff-only || (pause & exit /b 1)
)
rem La tache planifiee garde npm run start (et esbuild.exe) ouvert en permanence ;
rem sous Windows (contrairement a Linux) npm ci ne peut pas remplacer un fichier
rem verrouille par un process en cours - on arrete donc l'appli avant de mettre a jour.
echo Arret de l'application...
schtasks /end /tn Zebralsace >nul 2>&1
timeout /t 2 /nobreak >nul

rem le process qui vient d'etre tue (ou un antivirus qui scanne le .node
rem fraichement ecrit) peut garder le fichier verrouille un instant : on
rem retente plutot que d'echouer sur un premier EPERM
set TENTATIVES=0
:npm_ci_retry
call npm ci
if errorlevel 1 (
  set /a TENTATIVES+=1
  if %TENTATIVES% lss 6 (
    echo Fichier verrouille ^(antivirus ou arret en cours^), nouvel essai dans 3s...
    timeout /t 3 /nobreak >nul
    goto npm_ci_retry
  )
  echo npm ci a echoue apres plusieurs tentatives - fichier probablement verrouille en permanence ^(antivirus ?^).
  pause
  exit /b 1
)
call npm run build || (pause & exit /b 1)

echo Redemarrage de l'application...
schtasks /run /tn Zebralsace >nul 2>&1

echo Mise a jour terminee.
echo Installation via NSSM au lieu de la tache planifiee : redemarrez avec "nssm restart zebra-etiquettes".
pause
