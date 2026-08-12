import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_SETTINGS: Record<string, string> = {
  printer_ip: '',
  printer_port: '9100',
  dpi: '300',
  laize_mm: '104',
  admin_mdp: '', // vide = pas d'authentification ; sinon "sel:empreinte" (scrypt)
  licence_client: '', // titulaire de la licence, affiché dans Réglages
  licence_ref: '', // référence du contrat
  contraste: '15',
  vitesse: '4',
  offset_x: '0',
  offset_y: '0',
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  largeur_mm REAL NOT NULL DEFAULT 85,
  hauteur_mm REAL NOT NULL DEFAULT 55,
  dlc_jours INTEGER NOT NULL DEFAULT 365,
  quantite_carton INTEGER NOT NULL DEFAULT 15,
  poids_g INTEGER NOT NULL DEFAULT 280,
  categorie TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  doc_json TEXT NOT NULL DEFAULT '{"objects":[]}',
  vignette_png TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS globals (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS logos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'logo' CHECK (type IN ('logo', 'code-barres')),
  chemin_fichier TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS print_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_heure TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  template_nom TEXT NOT NULL,
  quantite INTEGER NOT NULL,
  statut TEXT NOT NULL CHECK (statut IN ('ok', 'erreur')),
  erreur_message TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);
`

// Migrations de schéma : chaque entrée est un SQL exécuté UNE seule fois, dans
// l'ordre, sur les bases existantes (suivi via PRAGMA user_version). Toute
// modification d'une table existante (ALTER TABLE…) s'ajoute ICI, jamais dans
// SCHEMA (le CREATE IF NOT EXISTS ne rejoue pas sur une base déjà créée).
const MIGRATIONS: string[] = [
  // v1 : catégories et ordre d'affichage des modèles au kiosque
  `ALTER TABLE templates ADD COLUMN categorie TEXT NOT NULL DEFAULT '';
   ALTER TABLE templates ADD COLUMN position INTEGER NOT NULL DEFAULT 0;`,
  // v2 : ordre d'affichage des médias
  `ALTER TABLE logos ADD COLUMN position INTEGER NOT NULL DEFAULT 0;`,
  // v3 : catégories persistées (ordre, renommage, suppression) — la table est
  // déjà créée par le SCHEMA, on la peuple depuis les modèles existants
  `INSERT OR IGNORE INTO categories (nom) SELECT DISTINCT categorie FROM templates WHERE categorie <> '';`,
  // v4 : quantité par carton — variable {{quantite}}, comme la DLC
  `ALTER TABLE templates ADD COLUMN quantite_carton INTEGER NOT NULL DEFAULT 15;`,
  // v5 : poids unitaire (g) — variable {{poids}}, comme quantite_carton
  `ALTER TABLE templates ADD COLUMN poids_g INTEGER NOT NULL DEFAULT 280;`,
]

export function initDb(dataDir: string): Database.Database {
  fs.mkdirSync(path.join(dataDir, 'logos'), { recursive: true })
  const db = new Database(path.join(dataDir, 'zebra.db'))
  db.pragma('journal_mode = WAL')
  const neuve = !db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='templates'")
    .get()
  db.exec(SCHEMA)
  // base neuve : le SCHEMA est déjà au dernier état, rien à rejouer
  if (neuve) db.pragma(`user_version = ${MIGRATIONS.length}`)
  const ins = db.prepare('INSERT OR IGNORE INTO settings (cle, valeur) VALUES (?, ?)')
  for (const [cle, valeur] of Object.entries(DEFAULT_SETTINGS)) ins.run(cle, valeur)
  const version = db.pragma('user_version', { simple: true }) as number
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec(MIGRATIONS[i])
    db.pragma(`user_version = ${i + 1}`)
  }
  return db
}

export function getSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT cle, valeur FROM settings').all() as { cle: string; valeur: string }[]
  return Object.fromEntries(rows.map((r) => [r.cle, r.valeur]))
}
