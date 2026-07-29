import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import type Database from 'better-sqlite3'
import { getSettings } from './db'
import { getStatus } from './printer'
import { createQueue } from './queue'

export function createApp(db: Database.Database, dataDir: string): express.Express {
  const app = express()
  app.use(express.json({ limit: '20mb' }))

  const api = express.Router()

  const VERSION = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')).version as string
  api.get('/ping', (_req, res) => res.json({ ok: true, version: VERSION }))

  // ---- authentification admin (active seulement si un mot de passe est défini) ----
  const sessions = new Set<string>()
  const HASH_RE = /^[0-9a-f]{32}:[0-9a-f]{64}$/
  const hacher = (mdp: string, sel: string) => crypto.scryptSync(mdp, sel, 32).toString('hex')

  function jetonValide(req: express.Request): boolean {
    const jeton = /(?:^|;\s*)session=([0-9a-f]+)/.exec(req.headers.cookie ?? '')?.[1]
    return !!jeton && sessions.has(jeton)
  }

  api.get('/session', (req, res) => {
    const requis = !!getSettings(db).admin_mdp
    res.json({ requis, connecte: !requis || jetonValide(req) })
  })

  api.post('/login', (req, res) => {
    const attendu = getSettings(db).admin_mdp ?? ''
    if (!attendu) return res.json({ ok: true })
    const [sel, hash] = attendu.split(':')
    if (hacher(String(req.body?.mdp ?? ''), sel) !== hash) {
      return res.status(401).json({ erreur: 'mot de passe incorrect' })
    }
    const jeton = crypto.randomBytes(32).toString('hex')
    sessions.add(jeton)
    res.setHeader('Set-Cookie', `session=${jeton}; HttpOnly; Path=/; SameSite=Strict`)
    res.json({ ok: true })
  })

  // Mutations d'administration protégées ; lectures et impression restent
  // libres — le kiosque fonctionne sans authentification.
  const PROTEGEES: Array<[string, RegExp]> = [
    ['POST', /^\/templates/],
    ['PUT', /^\/templates/],
    ['DELETE', /^\/templates/],
    ['PUT', /^\/globals/],
    ['DELETE', /^\/globals/],
    ['PUT', /^\/settings$/],
    ['POST', /^\/logos/],
    ['DELETE', /^\/logos/],
  ]
  api.use((req, res, next) => {
    if (!getSettings(db).admin_mdp) return next()
    if (!PROTEGEES.some(([m, re]) => req.method === m && re.test(req.path))) return next()
    if (jetonValide(req)) return next()
    res.status(401).json({ erreur: 'authentification requise' })
  })

  // ---- templates ----
  const templateParId = db.prepare('SELECT * FROM templates WHERE id = ?')

  api.get('/templates', (_req, res) => {
    res.json(
      db
        .prepare(
          'SELECT * FROM templates ORDER BY categorie COLLATE NOCASE, position, nom COLLATE NOCASE'
        )
        .all()
    )
  })

  api.post('/templates', (req, res) => {
    const nom = String(req.body?.nom ?? '').trim()
    if (!nom) return res.status(400).json({ erreur: 'nom requis' })
    // taille par défaut explicite : vaut aussi pour les bases créées avant ce défaut
    const r = db.prepare('INSERT INTO templates (nom, largeur_mm, hauteur_mm) VALUES (?, 85, 55)').run(nom)
    res.status(201).json(templateParId.get(r.lastInsertRowid))
  })

  api.get('/templates/:id', (req, res) => {
    const t = templateParId.get(req.params.id)
    if (!t) return res.status(404).json({ erreur: 'template introuvable' })
    res.json(t)
  })

  api.put('/templates/:id', (req, res) => {
    const t = templateParId.get(req.params.id)
    if (!t) return res.status(404).json({ erreur: 'template introuvable' })
    const champs = ['nom', 'largeur_mm', 'hauteur_mm', 'dlc_jours', 'doc_json', 'vignette_png', 'categorie', 'position']
    const maj = champs.filter((c) => req.body[c] !== undefined)
    if (maj.includes('nom') && !String(req.body.nom ?? '').trim())
      return res.status(400).json({ erreur: 'nom requis' })
    for (const c of maj)
      db.prepare(`UPDATE templates SET ${c} = ? WHERE id = ?`).run(req.body[c], req.params.id)
    db.prepare("UPDATE templates SET updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id)
    res.json(templateParId.get(req.params.id))
  })

  api.delete('/templates/:id', (req, res) => {
    db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id)
    res.json({ ok: true })
  })

  api.post('/templates/:id/duplicate', (req, res) => {
    const t = templateParId.get(req.params.id) as any
    if (!t) return res.status(404).json({ erreur: 'template introuvable' })
    const nom = String(req.body?.nom ?? '').trim() || `${t.nom} (copie)`
    const r = db
      .prepare(
        'INSERT INTO templates (nom, largeur_mm, hauteur_mm, dlc_jours, doc_json, vignette_png, categorie, position) VALUES (?,?,?,?,?,?,?,?)'
      )
      .run(nom, t.largeur_mm, t.hauteur_mm, t.dlc_jours, t.doc_json, t.vignette_png, t.categorie, t.position)
    res.status(201).json(templateParId.get(r.lastInsertRowid))
  })

  // ---- globals ----
  api.get('/globals', (_req, res) => {
    res.json(db.prepare('SELECT cle, valeur FROM globals ORDER BY cle').all())
  })
  api.put('/globals/:cle', (req, res) => {
    db.prepare(
      'INSERT INTO globals (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur'
    ).run(req.params.cle, String(req.body?.valeur ?? ''))
    res.json({ ok: true })
  })
  api.delete('/globals/:cle', (req, res) => {
    db.prepare('DELETE FROM globals WHERE cle = ?').run(req.params.cle)
    res.json({ ok: true })
  })

  // ---- settings ----
  api.get('/settings', (_req, res) => {
    const rows = db.prepare('SELECT cle, valeur FROM settings').all() as any[]
    res.json(Object.fromEntries(rows.map((r) => [r.cle, r.valeur])))
  })
  api.put('/settings', (req, res) => {
    const up = db.prepare(
      'INSERT INTO settings (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur'
    )
    for (const [cle, valeur] of Object.entries(req.body ?? {})) {
      let v = String(valeur)
      // le mot de passe admin est stocké haché (sel:empreinte), jamais en clair
      if (cle === 'admin_mdp' && v && !HASH_RE.test(v)) {
        const sel = crypto.randomBytes(16).toString('hex')
        v = `${sel}:${hacher(v, sel)}`
      }
      up.run(cle, v)
    }
    res.json({ ok: true })
  })

  // ---- logos ----
  api.get('/logos', (_req, res) => {
    res.json(db.prepare('SELECT * FROM logos ORDER BY nom COLLATE NOCASE').all())
  })
  api.post('/logos', (req, res) => {
    const { nom, type, png } = req.body ?? {}
    if (!nom || !['logo', 'code-barres'].includes(type) || !String(png).startsWith('data:image/png;base64,'))
      return res.status(400).json({ erreur: 'nom, type et png (dataURL) requis' })
    const r = db.prepare("INSERT INTO logos (nom, type, chemin_fichier) VALUES (?, ?, '')").run(nom, type)
    const fichier = `${r.lastInsertRowid}.png`
    fs.writeFileSync(
      path.join(dataDir, 'logos', fichier),
      Buffer.from(String(png).split(',')[1], 'base64')
    )
    db.prepare('UPDATE logos SET chemin_fichier = ? WHERE id = ?').run(fichier, r.lastInsertRowid)
    res.status(201).json(db.prepare('SELECT * FROM logos WHERE id = ?').get(r.lastInsertRowid))
  })
  api.delete('/logos/:id', (req, res) => {
    const logo = db.prepare('SELECT * FROM logos WHERE id = ?').get(req.params.id) as any
    if (logo) {
      fs.rmSync(path.join(dataDir, 'logos', logo.chemin_fichier), { force: true })
      db.prepare('DELETE FROM logos WHERE id = ?').run(req.params.id)
    }
    res.json({ ok: true })
  })

  // ---- statut et impression (via la file, un job à la fois) ----
  const file = createQueue(db)

  api.get('/status', async (_req, res) => {
    const s = getSettings(db)
    res.json({ ...(await getStatus(s.printer_ip, Number(s.printer_port))), file: file.snapshot() })
  })

  api.post('/print', (req, res) => {
    const { template_nom, quantite, png } = req.body ?? {}
    if (
      typeof template_nom !== 'string' ||
      !Number.isInteger(quantite) ||
      quantite < 1 ||
      quantite > 99_999_999 || // limite du champ ^PQ, pas un plafond métier
      !String(png).startsWith('data:image/png;base64,')
    ) {
      return res.status(400).json({ erreur: 'template_nom, quantite (≥ 1) et png (dataURL) requis' })
    }
    res.status(202).json(file.enfiler(template_nom, quantite, String(png)))
  })

  api.get('/print-log', (req, res) => {
    const clauses: string[] = []
    const params: string[] = []
    if (req.query.statut) { clauses.push('statut = ?'); params.push(String(req.query.statut)) }
    if (req.query.from) { clauses.push('date(date_heure) >= ?'); params.push(String(req.query.from)) }
    if (req.query.to) { clauses.push('date(date_heure) <= ?'); params.push(String(req.query.to)) }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    res.json(
      db.prepare(`SELECT * FROM print_log ${where} ORDER BY date_heure DESC, id DESC LIMIT 500`).all(...params)
    )
  })

  app.use('/api', api)
  app.use('/logos', express.static(path.join(dataDir, 'logos')))

  const dist = path.resolve('web/dist')
  if (fs.existsSync(dist)) {
    app.use(express.static(dist))
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(dist, 'index.html'))
      }
      next()
    })
  }
  return app
}
