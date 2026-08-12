# Zebralsace

Application web auto-hébergée pour imprimer des étiquettes (alimentaires ou
autres) sur une imprimante thermique Zebra en réseau : un kiosque
d'impression pour l'atelier, un éditeur visuel pour créer les modèles sans
compétence technique.

Le navigateur rend l'étiquette en PNG à la résolution native de l'imprimante ;
le serveur la convertit en ZPL `^GFA` (bitmap 1 bit) et l'envoie sur le port
TCP 9100. **Un seul chemin de rendu** : l'aperçu affiché à l'écran est
exactement ce qui sort de l'imprimante.

## Fonctionnalités

- **Kiosque** (`/`) — modèles par **sections de catégories**, organisées par
  **glisser-déposer** dans l'admin (ordre et catégorie), aperçu exact avec dates
  calculées automatiquement (fabrication, DLC = fabrication + durée du
  modèle), dates modifiables au moment d'imprimer, option « sans date de
  péremption », quantité sans plafond, ou mode **« Étiquette carton »**
  (une seule étiquette, affichant la quantité par carton du modèle), indicateur
  d'état imprimante en direct (fin de papier, tête ouverte, pause…), file
  d'impression visible avec l'état de chaque lot. Installable en PWA plein écran.
- **Éditeur visuel** (`/admin`) — glisser-déposer sur un canvas à l'échelle,
  grille magnétique, textes avec gras/italique **par portion** (allergènes en
  gras au milieu d'un paragraphe), variables `{{date}}`, `{{dlc}}`,
  `{{date+N}}`, `{{quantite}}` (quantité par carton, éditable par modèle) et
  valeurs partagées, insertion de médias par titre avec aperçu depuis la
  bibliothèque partagée, formes noir/blanc (rectangles à bords arrondis ou
  carrés), **tableaux nutritionnels générés et rééditables** (format INCO),
  annuler/rétablir (Ctrl+Z/Y), aperçu aux valeurs du jour, impression de test.
- **Médias** — onglet dédié : bibliothèque partagée entre tous les modèles,
  import d'images nommées (optimisées noir et blanc à l'import) et
  **génération nommée de codes-barres EAN-13, Code 128 et QR** (100 %
  locale, aucun service externe, jamais redimensionnés au placement).
- **Administration** — historique des impressions filtrable par dates,
  rapports d'erreur avec motif, réglages imprimante (IP, résolution
  203/300/600 dpi, laize, contraste, vitesse, décalages X/Y), duplication
  de modèles avec choix du nom.
- **Simulateur d'imprimante** — développez sans matériel : il répond au
  statut `~HS` (pannes simulables d'un clic) et décode les jobs `^GFA`
  reçus pour afficher l'étiquette en direct dans le navigateur.

## Stack

Node 22+, Express 4, SQLite (better-sqlite3), Vue 3, Naive UI, Fabric.js v7,
pngjs. Aucune dépendance cloud : tout tourne sur le LAN.

## Démarrer

```bash
npm ci
npm run simulator   # fausse imprimante : ZPL sur :9100, suivi sur http://localhost:9101
npm run dev         # API :3000 + front sur http://localhost:5173
```

Puis dans Administration → Réglages : IP `127.0.0.1`, port `9100` →
l'indicateur passe au vert et chaque impression s'affiche, décodée en image,
sur la page du simulateur.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Développement (API + Vite, rechargement à chaud) |
| `npm run simulator` | Simulateur d'imprimante (ZPL :9100, page :9101) |
| `npm test` | Tests unitaires (vitest) |
| `npm run e2e` | Tests bout en bout (Playwright, fausse imprimante TCP, snapshot de rendu au pixel près) |
| `npm run build` puis `npm run start` | Production sur :3000 |

## Imprimantes supportées

Toute imprimante Zebra parlant **ZPL II** et joignable en TCP/IP (port 9100),
soit l'essentiel des gammes ZT, ZD, GK/GX, ZQ… Résolution (203, 300 ou
600 dpi) et laize (largeur maximale d'impression) se configurent dans les
réglages. Hors périmètre : connexions USB/Bluetooth et anciens modèles
EPL-only.

## Plusieurs utilisateurs en même temps

Kiosques et administration peuvent être ouverts simultanément sur autant de
postes que nécessaire : la file d'impression sérialise les envois côté
serveur et la base (SQLite en mode WAL) accepte les lectures concurrentes.
Seule limite : si deux personnes enregistrent le même modèle au même
moment, le dernier enregistrement gagne.

Évolution prévue : gestion de plusieurs imprimantes, avec choix de
l'imprimante au kiosque.

## Déploiement

Prérequis : Node 22+ et une imprimante joignable en TCP sur le port 9100
depuis le serveur — la topologie importe peu (LAN, VLAN, VPN…).

```bash
npm ci
npm run build
npm run start        # sert l'application sur :3000 (PORT et DATA_DIR surchargeables)
```

Trois canaux d'installation, selon l'équipement du site :

- **Linux (depuis les sources)** : `bash deploy/installer.sh` — installe les
  dépendances, build, crée et démarre le service systemd (adapté au dossier
  et à l'utilisateur courants).
- **Windows (depuis les sources)** : `deploy\installer.cmd` (en
  administrateur) — installe les dépendances, build, et enregistre une tâche
  planifiée « Zebralsace » qui démarre avec la machine et relance
  l'application si elle s'arrête. Alternative « vrai service » :
  [NSSM](https://nssm.cc).
- **Docker** (serveur ou NAS déjà en place) : `docker compose up -d` avec le
  `compose.yml` fourni — image `ghcr.io/zroumane/zebralsace` publiée par la
  CI à chaque version taguée (authentification GHCR : token `packages:read`).
  Mise à jour : `docker compose pull && docker compose up -d`.

Côté postes : un simple site web, utilisable dans n'importe quel navigateur
(installable en PWA plein écran).

### Mises à jour

`bash deploy/mettre-a-jour.sh` (Linux) ou `deploy\mettre-a-jour.cmd`
(Windows) : récupère la **dernière version taguée** (validée par la CI — la
production ne suit jamais `main` directement), réinstalle, rebuild et
redémarre le service. Au premier lancement, le script génère une **clé de
déploiement** dédiée (`deploy/cle-deploiement`, gitignorée) et affiche la clé
publique à ajouter dans GitHub → Settings → Deploy keys (lecture seule) —
la machine de production n'a ainsi jamais besoin de vos identifiants.
La version installée s'affiche en bas de l'onglet Réglages.

Pour la maintenance à distance sans rien exposer : un accès sortant type
[Tailscale](https://tailscale.com) (aucun port à ouvrir, gratuit jusqu'à
100 machines) permet au prestataire de lancer le script de mise à jour
sans intervention sur site.

### Sauvegardes

`bash deploy/sauvegarde.sh [dossier]` (Linux) ou `deploy\sauvegarde.cmd
[dossier]` (Windows) : copie cohérente de la base (API de sauvegarde SQLite,
sûre même en cours d'écriture) + logos, rétention des 30 dernières. À
planifier : `0 3 * * *` en cron, ou `schtasks /sc daily /st 03:00` sous
Windows (exemple complet en tête du script).

### Sécurité

Un **mot de passe administrateur** optionnel se définit dans Réglages →
Sécurité : les modifications (modèles, réglages, valeurs partagées, images)
demandent alors une connexion ; le kiosque et l'impression restent libres.
Stocké haché (scrypt), jamais en clair. Pour une exposition au-delà du LAN,
placez l'application derrière un reverse proxy HTTPS (Caddy, nginx…).

Note : les suites de test (`npm run e2e`) supposent un shell POSIX — sous
Windows, utilisez WSL.

## Dossiers

- `server/` — Express, SQLite, conversion PNG → ZPL, socket imprimante, file d'impression
- `web/` — Vue 3 : kiosque, admin, éditeur, chemin de rendu unique (`src/render.ts`)
- `simulator/` — simulateur d'imprimante (serveur ZPL + page de suivi)
- `tests/` — `unit/` (vitest) et `e2e/` (Playwright)
- `deploy/` — installation, mise à jour et sauvegarde : scripts `.sh`
  (Linux, service systemd) et `.cmd` (Windows, tâche planifiée), à
  fonctionnalités identiques
