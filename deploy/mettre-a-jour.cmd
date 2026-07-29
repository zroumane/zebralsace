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
  exit /b 0
)

set GIT_SSH_COMMAND=ssh -i deploy/cle-deploiement -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new
echo Recuperation de la derniere version...
git fetch --tags --force origin || exit /b 1
rem Les machines clientes suivent la derniere version TAGUEE ; sans tag, repli sur main.
set TAG=
for /f "delims=" %%t in ('git tag --sort=-v:refname') do if not defined TAG set TAG=%%t
if defined TAG (
  echo Passage a la version %TAG%
  git checkout -q %TAG% || exit /b 1
) else (
  git pull --ff-only || exit /b 1
)
call npm ci || exit /b 1
call npm run build || exit /b 1

echo Mise a jour terminee. Pour redemarrer :
echo   schtasks /end /tn Zebralsace ^&^& schtasks /run /tn Zebralsace   (tache planifiee)
echo   nssm restart zebra-etiquettes                                   (si installe via NSSM)
echo   sinon : double-clic sur deploy\zebra-etiquettes.cmd
