#!/usr/bin/env bash
# Installe l'application en service systemd (Linux).
# À lancer depuis le dossier du dépôt : bash deploy/installer.sh
set -euo pipefail
cd "$(dirname "$0")/.."

command -v node >/dev/null || { echo "Node.js 22+ requis (https://nodejs.org)"; exit 1; }

echo "Installation des dépendances et build…"
npm ci
npm run build
mkdir -p logs

# Unité systemd adaptée au dossier courant, à l'utilisateur courant et au npm réel
SERVICE=/etc/systemd/system/zebra-etiquettes.service
sed "s|/opt/zebra-etiquettes|$PWD|g; s|^User=.*|User=$(id -un)|; s|/usr/bin/npm|$(command -v npm)|" \
  deploy/zebra-etiquettes.service | sudo tee "$SERVICE" >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now zebra-etiquettes

echo
echo "Service installé et démarré. Vérification :"
sleep 1
curl -s localhost:3000/api/ping && echo " ← l'application répond sur le port 3000"
echo "Journal : sudo journalctl -u zebra-etiquettes -f  (ou tail -f logs/app.log)"
