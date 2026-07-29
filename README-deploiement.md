# Mise en service — poste d'impression d'étiquettes

## 1. Prérequis réseau

- Serveur (mini-PC) : **IP fixe** sur le LAN, câble Ethernet recommandé.
- ⚠️ L'adresse IP du serveur ne doit **jamais changer** après la création des
  premiers modèles : les étiquettes enregistrent l'adresse complète de leurs
  images — changer l'IP casserait les modèles existants.
- Imprimante Zebra ZT231 : **IP fixe** (panneau : MENU → RÉSEAU), Ethernet ou WiFi.
- iPad : WiFi sur le même LAN.

## 2. Installation sur le serveur (Debian/Ubuntu)

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

sudo useradd -r -d /opt/zebra-etiquettes zebra
sudo mkdir -p /opt/zebra-etiquettes
sudo chown zebra:zebra /opt/zebra-etiquettes
sudo -u zebra git clone <depot> /opt/zebra-etiquettes
cd /opt/zebra-etiquettes
sudo -u zebra npm ci
sudo -u zebra npm run build

sudo cp deploy/zebra-etiquettes.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zebra-etiquettes
curl -s localhost:3000/api/ping   # → {"ok":true}
```

## 3. Configuration

1. Ouvrir `http://<ip-serveur>:3000/admin` → Réglages.
2. Renseigner l'IP de l'imprimante, « Tester la connexion » → vert attendu.
3. La résolution est préréglée sur **300 dpi** (modèle ZT231 acheté) — ne pas
   la changer après la création des premiers modèles.
4. Renseigner les valeurs partagées (adresse, téléphone…).

## 4. iPad

1. Safari → `http://<ip-serveur>:3000/`.
2. Partager → « Sur l'écran d'accueil » → l'app s'ouvre en plein écran.
3. Réglages iPad : verrouillage automatique « Jamais » ; l'iPad peut rester
   branché en permanence sur son chargeur.

## 5. Checklist de calibration (imprimante réelle)

- [ ] Imprimer un modèle de test avec un cadre de 50 mm : mesurer au réglet,
      50 mm exactement (sinon vérifier que la résolution des Réglages est
      bien 300 dpi, celle du modèle acheté).
- [ ] Texte net et noir : ajuster **Contraste** (monter si pâle, baisser si
      les lettres bavent), réimprimer.
- [ ] Étiquette centrée sur son support : ajuster les **décalages** X/Y.
- [ ] Scanner le code-barres EAN-13 imprimé avec une douchette ou un
      téléphone : lecture au premier passage.
- [ ] Débrancher l'imprimante : le kiosque passe au rouge avec le motif,
      IMPRIMER se désactive ; rebrancher : retour au vert sans toucher l'iPad.
