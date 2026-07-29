#!/usr/bin/env bash
# Met à jour l'application depuis GitHub puis redémarre le service (Linux).
# Premier lancement : génère une clé de déploiement (deploy/cle-deploiement,
# gitignorée) à ajouter dans GitHub → Settings → Deploy keys (lecture seule).
set -euo pipefail
cd "$(dirname "$0")/.."

CLE="$PWD/deploy/cle-deploiement"
if [ ! -f "$CLE" ]; then
  ssh-keygen -t ed25519 -N "" -C "deploiement-etiquettes-$(hostname)" -f "$CLE" >/dev/null
  echo "Clé de déploiement générée. Ajoutez la clé PUBLIQUE ci-dessous au dépôt"
  echo "GitHub : Settings → Deploy keys → Add deploy key (laisser en lecture seule) :"
  echo
  cat "$CLE.pub"
  echo
  echo "Puis relancez ce script."
  exit 0
fi

URL=$(git remote get-url origin)
case "$URL" in
  git@*|ssh://*) ;;
  *) echo "⚠ Le remote origin n'est pas en SSH ($URL) — la clé de déploiement ne peut pas servir." ;;
esac

export GIT_SSH_COMMAND="ssh -i $CLE -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
echo "Récupération de la dernière version…"
git fetch --tags --force origin
# Les machines clientes suivent la dernière version TAGUÉE (validée par la CI),
# pas la branche main. Sans aucun tag, repli sur main.
TAG=$(git tag --sort=-v:refname | head -1)
if [ -n "$TAG" ]; then
  echo "Passage à la version $TAG"
  git checkout -q "$TAG"
else
  git pull --ff-only
fi
npm ci
npm run build

if systemctl is-enabled --quiet zebra-etiquettes 2>/dev/null; then
  sudo systemctl restart zebra-etiquettes
  echo "Service redémarré."
else
  echo "Pas de service systemd installé — relancez l'application (npm run start ou bash deploy/installer.sh)."
fi
echo "Mise à jour terminée."
