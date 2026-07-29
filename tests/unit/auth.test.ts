import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { initDb } from '../../server/db'
import { createApp } from '../../server/routes'

let app: ReturnType<typeof createApp>

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zebra-auth-'))
  app = createApp(initDb(dir), dir)
})

describe('authentification admin', () => {
  it('sans mot de passe : tout est libre', async () => {
    await request(app).post('/api/templates').send({ nom: 'Libre' }).expect(201)
    const { body } = await request(app).get('/api/session').expect(200)
    expect(body).toEqual({ requis: false, connecte: true })
  })

  it('mot de passe défini : haché, mutations protégées, kiosque libre', async () => {
    await request(app).put('/api/settings').send({ admin_mdp: 'secret' }).expect(200)
    const { body: s } = await request(app).get('/api/settings').expect(200)
    expect(s.admin_mdp).not.toContain('secret')
    expect(s.admin_mdp).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/)

    // mutations bloquées sans session
    await request(app).post('/api/templates').send({ nom: 'X' }).expect(401)
    await request(app).put('/api/settings').send({ dpi: '203' }).expect(401)
    // lectures et statut restent libres (kiosque)
    await request(app).get('/api/templates').expect(200)
    await request(app).get('/api/status').expect(200)
    const { body: session } = await request(app).get('/api/session').expect(200)
    expect(session).toEqual({ requis: true, connecte: false })

    // mauvais mot de passe → refus
    await request(app).post('/api/login').send({ mdp: 'faux' }).expect(401)
    // bon mot de passe → cookie de session → mutations autorisées
    const login = await request(app).post('/api/login').send({ mdp: 'secret' }).expect(200)
    const cookie = login.headers['set-cookie'][0]
    await request(app).post('/api/templates').set('Cookie', cookie).send({ nom: 'Protégé' }).expect(201)

    // le hash relu peut être renvoyé tel quel sans être re-haché
    const { body: avant } = await request(app).get('/api/settings')
    await request(app).put('/api/settings').set('Cookie', cookie).send({ admin_mdp: avant.admin_mdp }).expect(200)
    const { body: apres } = await request(app).get('/api/settings')
    expect(apres.admin_mdp).toBe(avant.admin_mdp)

    // désactivation (connecté) → tout redevient libre
    await request(app).put('/api/settings').set('Cookie', cookie).send({ admin_mdp: '' }).expect(200)
    await request(app).post('/api/templates').send({ nom: 'Re-libre' }).expect(201)
  })
})
