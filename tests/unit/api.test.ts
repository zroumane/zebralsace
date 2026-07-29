import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { initDb } from '../../server/db'
import { createApp } from '../../server/routes'

let app: ReturnType<typeof createApp>
let dataDir: string

beforeAll(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zebra-api-'))
  app = createApp(initDb(dataDir), dataDir)
})

// PNG 1x1 noir valide, encodé en dataURL
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('templates', () => {
  it('CRUD complet', async () => {
    const { body: t } = await request(app).post('/api/templates').send({ nom: 'Quiche' }).expect(201)
    expect(t.nom).toBe('Quiche')
    expect(t.largeur_mm).toBe(85)
    expect(t.hauteur_mm).toBe(55)

    await request(app)
      .put(`/api/templates/${t.id}`)
      .send({ dlc_jours: 21, doc_json: '{"objects":[1]}' })
      .expect(200)

    const { body: relu } = await request(app).get(`/api/templates/${t.id}`).expect(200)
    expect(relu.dlc_jours).toBe(21)

    const { body: copie } = await request(app).post(`/api/templates/${t.id}/duplicate`).expect(201)
    expect(copie.nom).toBe('Quiche (copie)')
    expect(copie.doc_json).toBe('{"objects":[1]}')

    await request(app).delete(`/api/templates/${copie.id}`).expect(200)
    await request(app).get(`/api/templates/${copie.id}`).expect(404)
  })

  it('catégorie et position : modifiables, triées, copiées à la duplication', async () => {
    const { body: a } = await request(app).post('/api/templates').send({ nom: 'Zeta' }).expect(201)
    const { body: b } = await request(app).post('/api/templates').send({ nom: 'Alpha' }).expect(201)
    await request(app).put(`/api/templates/${a.id}`).send({ categorie: 'Tartes', position: 1 }).expect(200)
    await request(app).put(`/api/templates/${b.id}`).send({ categorie: 'Tartes', position: 2 }).expect(200)

    const { body: liste } = await request(app).get('/api/templates').expect(200)
    const tartes = liste.filter((t: any) => t.categorie === 'Tartes').map((t: any) => t.nom)
    expect(tartes).toEqual(['Zeta', 'Alpha']) // position prime sur l'ordre alphabétique

    const { body: copie } = await request(app).post(`/api/templates/${a.id}/duplicate`).expect(201)
    expect(copie.categorie).toBe('Tartes')
    expect(copie.position).toBe(1)
    for (const t of [a, b, copie]) await request(app).delete(`/api/templates/${t.id}`)
  })

  it('duplique avec un nom personnalisé', async () => {
    const { body: t } = await request(app).post('/api/templates').send({ nom: 'Base' }).expect(201)
    const { body: copie } = await request(app)
      .post(`/api/templates/${t.id}/duplicate`)
      .send({ nom: 'Quiche géantes' })
      .expect(201)
    expect(copie.nom).toBe('Quiche géantes')
  })

  it('refuse un nom vide', async () => {
    await request(app).post('/api/templates').send({ nom: '  ' }).expect(400)
  })

  it('refuse un nom null en modification', async () => {
    const { body: t } = await request(app).post('/api/templates').send({ nom: 'Valide' }).expect(201)
    await request(app).put(`/api/templates/${t.id}`).send({ nom: null }).expect(400)
  })
})

describe('globals et settings', () => {
  it('upsert et suppression de globale', async () => {
    await request(app).put('/api/globals/adresse').send({ valeur: 'Lyon' }).expect(200)
    await request(app).put('/api/globals/adresse').send({ valeur: 'Paris' }).expect(200)
    const { body } = await request(app).get('/api/globals').expect(200)
    expect(body).toEqual([{ cle: 'adresse', valeur: 'Paris' }])
    await request(app).delete('/api/globals/adresse').expect(200)
  })

  it('settings partiels', async () => {
    await request(app).put('/api/settings').send({ printer_ip: '192.168.1.50' }).expect(200)
    const { body } = await request(app).get('/api/settings').expect(200)
    expect(body.printer_ip).toBe('192.168.1.50')
    expect(body.dpi).toBe('300') // les autres clés restent
  })
})

describe('logos', () => {
  it('upload, listing, suppression', async () => {
    const { body: logo } = await request(app)
      .post('/api/logos')
      .send({ nom: 'AF', type: 'logo', png: PNG_1PX })
      .expect(201)
    expect(fs.existsSync(path.join(dataDir, 'logos', logo.chemin_fichier))).toBe(true)

    await request(app).get(`/logos/${logo.chemin_fichier}`).expect(200)

    await request(app).delete(`/api/logos/${logo.id}`).expect(200)
    expect(fs.existsSync(path.join(dataDir, 'logos', logo.chemin_fichier))).toBe(false)
  })

  it('refuse autre chose qu\'un dataURL PNG', async () => {
    await request(app).post('/api/logos').send({ nom: 'x', type: 'logo', png: 'hello' }).expect(400)
  })
})
