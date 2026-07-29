import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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
    expect(s.printer_port).toBe('9100')
    expect(s.printer_ip).toBe('')
  })

  it('refuse un statut invalide dans print_log', () => {
    const db = tmpDb()
    expect(() =>
      db.prepare("INSERT INTO print_log (template_nom, quantite, statut) VALUES ('x', 1, 'bof')").run()
    ).toThrow()
  })

  it('est idempotent (réouverture sans erreur)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zebra-'))
    initDb(dir).close()
    expect(() => initDb(dir)).not.toThrow()
  })
})
