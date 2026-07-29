#!/usr/bin/env bash
# Sauvegarde data/ (base SQLite + logos) avec rétention de 30 sauvegardes.
# À planifier, par ex. tous les jours à 3 h :
#   crontab -e  →  0 3 * * * bash /chemin/vers/deploy/sauvegarde.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DATA_DIR="${DATA_DIR:-./data}"
DEST="${1:-./sauvegardes}"
HORODATAGE=$(date +%Y-%m-%d_%H-%M-%S)
CIBLE="$DEST/$HORODATAGE"
mkdir -p "$CIBLE"

# Copie cohérente de la base via l'API de sauvegarde SQLite (sûre même en cours d'écriture)
node -e "require('better-sqlite3')('$DATA_DIR/zebra.db').backup('$CIBLE/zebra.db').then(()=>process.exit(0))"
cp -r "$DATA_DIR/logos" "$CIBLE/" 2>/dev/null || true

# Rétention : ne garde que les 30 plus récentes
ls -1d "$DEST"/*/ 2>/dev/null | sort | head -n -30 | xargs -r rm -rf

echo "Sauvegarde écrite dans $CIBLE"
