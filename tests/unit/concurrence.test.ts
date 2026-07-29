import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { initDb } from '../../server/db'
import { createApp } from '../../server/routes'
import { startFakePrinter } from '../e2e/fakePrinter'

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

async function attendre(cond: () => Promise<boolean>, ms = 4000) {
  const debut = Date.now()
  while (!(await cond())) {
    if (Date.now() - debut > ms) throw new Error('condition jamais atteinte')
    await new Promise((r) => setTimeout(r, 25))
  }
}

describe('accès simultanés', () => {
  it('5 kiosques impriment pendant qu’un admin modifie et consulte', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zebra-conc-'))
    const app = createApp(initDb(dir), dir)
    const p = await startFakePrinter()
    await request(app)
      .put('/api/settings')
      .send({ printer_ip: '127.0.0.1', printer_port: String(p.port) })
    const { body: t } = await request(app).post('/api/templates').send({ nom: 'Concurrence' }).expect(201)

    const kiosques = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/print')
        .send({ template_nom: `Kiosque ${i + 1}`, quantite: i + 1, png: PNG_1PX })
        .expect(202)
    )
    const admin = [
      request(app).put(`/api/templates/${t.id}`).send({ dlc_jours: 9 }).expect(200),
      request(app).put('/api/globals/adresse').send({ valeur: 'Lyon' }).expect(200),
      request(app).get('/api/status').expect(200),
      request(app).get('/api/print-log').expect(200),
    ]
    await Promise.all([...kiosques, ...admin])

    const journal = async () => (await request(app).get('/api/print-log')).body
    await attendre(async () => (await journal()).length === 5)
    expect((await journal()).every((l: any) => l.statut === 'ok')).toBe(true)
    // la file a sérialisé les 5 jobs, tous reçus par l'imprimante
    for (let i = 1; i <= 5; i++) expect(p.recu.join('')).toContain(`^PQ${i}`)
    const { body: relu } = await request(app).get(`/api/templates/${t.id}`).expect(200)
    expect(relu.dlc_jours).toBe(9)
    p.close()
  })
})
