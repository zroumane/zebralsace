import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { initDb } from '../../server/db'
import { createApp } from '../../server/routes'
import { startFakePrinter } from '../e2e/fakePrinter'

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

let app: ReturnType<typeof createApp>

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zebra-print-'))
  app = createApp(initDb(dir), dir)
})

async function configure(port: number) {
  await request(app).put('/api/settings').send({ printer_ip: '127.0.0.1', printer_port: String(port) })
}

const journal = async () => (await request(app).get('/api/print-log')).body

// la file est asynchrone : on attend qu'une condition devienne vraie
async function attendre(cond: () => Promise<boolean>, ms = 3000) {
  const debut = Date.now()
  while (!(await cond())) {
    if (Date.now() - debut > ms) throw new Error('condition jamais atteinte')
    await new Promise((r) => setTimeout(r, 25))
  }
}

describe('/api/status', () => {
  it('reflète la fausse imprimante et expose la file', async () => {
    const p = await startFakePrinter({ pause: true })
    await configure(p.port)
    const { body } = await request(app).get('/api/status').expect(200)
    expect(body).toMatchObject({ connecte: true, pret: false, message: 'imprimante en pause' })
    expect(body.file).toEqual([])
    p.close()
  })
})

describe('/api/print (file d’attente)', () => {
  it('enfile, imprime et journalise ok', async () => {
    const p = await startFakePrinter()
    await configure(p.port)
    const { body } = await request(app)
      .post('/api/print')
      .send({ template_nom: 'Quiche', quantite: 2, png: PNG_1PX })
      .expect(202)
    expect(body).toMatchObject({ template_nom: 'Quiche', quantite: 2 })

    await attendre(async () => (await journal()).length === 1)
    expect((await journal())[0]).toMatchObject({ template_nom: 'Quiche', quantite: 2, statut: 'ok' })
    expect(p.recu.join('')).toContain('^PQ2')

    const { body: statut } = await request(app).get('/api/status')
    expect(statut.file).toHaveLength(1)
    expect(statut.file[0]).toMatchObject({ template_nom: 'Quiche', etat: 'ok' })
    expect(statut.file[0].png).toBeUndefined()
    p.close()
  })

  it('sérialise les jobs dans l’ordre d’arrivée', async () => {
    const p = await startFakePrinter()
    await configure(p.port)
    for (const quantite of [1, 2, 3]) {
      await request(app)
        .post('/api/print')
        .send({ template_nom: `Lot ${quantite}`, quantite, png: PNG_1PX })
        .expect(202)
    }
    await attendre(async () => (await journal()).length === 3)
    const recu = p.recu.join('')
    expect(recu.indexOf('^PQ1')).toBeGreaterThan(-1)
    expect(recu.indexOf('^PQ1')).toBeLessThan(recu.indexOf('^PQ2'))
    expect(recu.indexOf('^PQ2')).toBeLessThan(recu.indexOf('^PQ3'))
    p.close()
  })

  it('imprimante bloquée → job en erreur dans la file + journal', async () => {
    const p = await startFakePrinter({ papier: true })
    await configure(p.port)
    await request(app)
      .post('/api/print')
      .send({ template_nom: 'Quiche', quantite: 5, png: PNG_1PX })
      .expect(202)
    await attendre(async () => (await journal()).length === 1)
    expect((await journal())[0]).toMatchObject({ statut: 'erreur', erreur_message: 'fin de papier', quantite: 5 })
    const { body: statut } = await request(app).get('/api/status')
    expect(statut.file[0]).toMatchObject({ etat: 'erreur', erreur_message: 'fin de papier' })
    p.close()
  })

  it('valide quantité et png, sans plafond métier', async () => {
    await request(app).post('/api/print').send({ template_nom: 'x', quantite: 0, png: PNG_1PX }).expect(400)
    await request(app).post('/api/print').send({ template_nom: 'x', quantite: 2, png: 'nope' }).expect(400)
    // seule borne haute : la limite du champ ^PQ lui-même
    await request(app)
      .post('/api/print')
      .send({ template_nom: 'x', quantite: 100_000_000, png: PNG_1PX })
      .expect(400)

    const p = await startFakePrinter()
    await configure(p.port)
    await request(app)
      .post('/api/print')
      .send({ template_nom: 'x', quantite: 1500, png: PNG_1PX })
      .expect(202)
    await attendre(async () => (await journal()).length === 1)
    expect(p.recu.join('')).toContain('^PQ1500')
    p.close()
  })

  it('ne garde que les 10 derniers jobs terminés dans la file', async () => {
    const p = await startFakePrinter()
    await configure(p.port)
    for (let i = 0; i < 12; i++) {
      await request(app)
        .post('/api/print')
        .send({ template_nom: `J${i}`, quantite: 1, png: PNG_1PX })
        .expect(202)
    }
    await attendre(async () => (await journal()).length === 12)
    const { body: statut } = await request(app).get('/api/status')
    expect(statut.file).toHaveLength(10)
    expect(statut.file[0].template_nom).toBe('J2')
    p.close()
  })
})
