import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { initDb, getSettings } from '../../server/db'

function tmpDb() {
  return initDb(fs.mkdtempSync(path.join(os.tmpdir(), 'zebra-')))
}

describe('db', () => {
  it('crée les 5 tables', () => {
    const db = tmpDb()
    const noms = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
      .map((r: any) => r.name)
    for (const t of ['templates', 'globals', 'logos', 'print_log', 'settings']) {
      expect(noms).toContain(t)
    }
  })

  it('insère les réglages par défaut', () => {
    const s = getSettings(tmpDb())
    expect(s.dpi).toBe('300')
    expect(s.laize_mm).toBe('104')
    expect(s.printer_port).toBe('9100')
    expect(s.printer_ip).toBe('')
  })

  it('refuse un statut invalide dans print_log', () => {
    const db = tmpDb()
    expect(() =>
      db.prepare("INSERT INTO print_log (template_nom, quantite, statut) VALUES ('x', 1, 'bof')").run()
    ).toThrow()
  })

  it('une base neuve est marquée au dernier schéma', () => {
    const db = tmpDb()
    expect(db.pragma('user_version', { simple: true })).toBe(1)
    const t = db.prepare("SELECT categorie, position FROM templates LIMIT 0").columns()
    expect(t.map((c) => c.name)).toEqual(['categorie', 'position'])
  })

  it('migre une base ancienne (colonnes categorie/position ajoutées)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zebra-migr-'))
    const vieille = new Database(path.join(dir, 'zebra.db'))
    vieille.exec(`CREATE TABLE templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      largeur_mm REAL NOT NULL DEFAULT 100,
      hauteur_mm REAL NOT NULL DEFAULT 50,
      dlc_jours INTEGER NOT NULL DEFAULT 7,
      doc_json TEXT NOT NULL DEFAULT '{"objects":[]}',
      vignette_png TEXT,
      created_at TEXT,
      updated_at TEXT
    )`)
    vieille.prepare("INSERT INTO templates (nom) VALUES ('Ancien')").run()
    vieille.close()

    const db = initDb(dir)
    const t = db.prepare("SELECT * FROM templates WHERE nom = 'Ancien'").get() as any
    expect(t.categorie).toBe('')
    expect(t.position).toBe(0)
    expect(db.pragma('user_version', { simple: true })).toBe(1)
  })

  it('est idempotent (réouverture sans erreur)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zebra-'))
    initDb(dir).close()
    expect(() => initDb(dir)).not.toThrow()
  })
})
