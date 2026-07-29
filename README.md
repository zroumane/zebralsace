# zebra — poste d'impression d'étiquettes (imprimantes Zebra)

Application web auto-hébergée pour imprimer des étiquettes (alimentaires ou
autres) sur une imprimante thermique Zebra en réseau : une tablette sert de
kiosque en atelier, un éditeur visuel permet de créer les modèles sans
compétence technique.

Le navigateur rend l'étiquette en PNG à la résolution native de l'imprimante ;
le serveur la convertit en ZPL `^GFA` (bitmap 1 bit) et l'envoie sur le port
TCP 9100. **Un seul chemin de rendu** : l'aperçu affiché à l'écran est
exactement ce qui sort de l'imprimante.

## Fonctionnalités

- **Kiosque tablette** (`/`) — grille de modèles, aperçu exact avec dates
  calculées automatiquement (fabrication, DLC = fabrication + durée du
  modèle), dates modifiables au moment d'imprimer, option « sans date de
  péremption », quantité sans plafond, indicateur d'état imprimante en
  direct (fin de papier, tête ouverte, pause…), file d'impression visible
  avec l'état de chaque lot. PWA plein écran pour tablette.
- **Éditeur visuel** (`/admin`) — glisser-déposer sur un canvas à l'échelle,
  grille magnétique, textes avec gras/italique **par portion** (allergènes en
  gras au milieu d'un paragraphe), variables `{{date}}`, `{{dlc}}`,
  `{{date+N}}` et valeurs partagées, bibliothèque d'images optimisées en
  noir et blanc à l'import (logos redimensionnés, codes-barres jamais
  agrandis), formes, aperçu aux valeurs du jour, impression de test.
- **Administration** — historique des impressions filtrable par dates,
  rapports d'erreur avec motif, réglages imprimante (IP, 203/300 dpi,
  contraste, vitesse, décalages X/Y), duplication de modèles avec choix
  du nom.
- **Simulateur d'imprimante** — développez sans matériel : il répond au
  statut `~HS` (pannes simulables d'un clic) et décode les jobs `^GFA`
  reçus pour afficher l'étiquette en direct dans le navigateur.

## Stack

Node 20+, Express 4, SQLite (better-sqlite3), Vue 3, Naive UI, Fabric.js v7,
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

Prérequis : Node 20+ et une imprimante joignable en TCP sur le port 9100
depuis le serveur — la topologie importe peu (LAN, VLAN, VPN…).

```bash
npm ci
npm run build
npm run start        # sert l'application sur :3000 (PORT et DATA_DIR surchargeables)
```

- **Linux** : unité systemd fournie — `deploy/zebra-etiquettes.service`
  (copier dans `/etc/systemd/system/`, adapter `WorkingDirectory`, puis
  `systemctl enable --now zebra-etiquettes`).
- **Windows** : script fourni — `deploy/zebra-etiquettes.cmd` ; pour un
  lancement automatique, Planificateur de tâches → « Au démarrage », ou
  [NSSM](https://nssm.cc) pour un vrai service.
- Côté postes : l'application est un simple site web — installable en plein
  écran (PWA) sur n'importe quelle tablette, ou utilisable au navigateur.

Note : les suites de test (`npm run e2e`) supposent un shell POSIX — sous
Windows, utilisez WSL.

## Dossiers

- `server/` — Express, SQLite, conversion PNG → ZPL, socket imprimante, file d'impression
- `web/` — Vue 3 : kiosque, admin, éditeur, chemin de rendu unique (`src/render.ts`)
- `tools/` — simulateur d'imprimante
- `tests/` — `unit/` (vitest) et `e2e/` (Playwright)
- `deploy/` — unité systemd
