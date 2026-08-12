import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { startFakePrinter } from './fakePrinter'

const doc = fs.readFileSync('tests/e2e/fixtures/demo-template.json', 'utf8')

test('impression de bout en bout depuis le kiosque', async ({ page, request }) => {
  const imprimante = await startFakePrinter()
  await request.put('/api/settings', {
    data: { printer_ip: '127.0.0.1', printer_port: String(imprimante.port) },
  })
  const { id } = await (
    await request.post('/api/templates', { data: { nom: 'Impression e2e' } })
  ).json()
  await request.put(`/api/templates/${id}`, { data: { doc_json: doc, dlc_jours: 14 } })

  await page.goto('/')
  await expect(page.getByTestId('statut-imprimante')).toContainText('Imprimante connectée')
  await page.getByTestId(`template-${id}`).click()

  // aperçu rendu, dates pré-remplies
  await expect(page.getByTestId('apercu')).toHaveAttribute('src', /^data:image\/png/)
  const fab = await page.getByTestId('date-fabrication').inputValue()
  const auj = new Date()
  expect(fab).toBe(
    `${auj.getFullYear()}-${String(auj.getMonth() + 1).padStart(2, '0')}-${String(auj.getDate()).padStart(2, '0')}`
  )

  const avant = await page.getByTestId('apercu').getAttribute('src')
  await page.getByTestId('date-fabrication').fill('2026-03-01')
  await expect.poll(async () => page.getByTestId('apercu').getAttribute('src')).not.toBe(avant)

  // la quantité par défaut du lot reprend la quantité par carton du modèle (15, valeur
  // par défaut d'un nouveau modèle) — plus de saisie manuelle à 1 par défaut
  await expect(page.getByTestId('quantite').locator('input')).toHaveValue('15')

  await page.getByTestId('imprimer').click()
  await expect(page.getByText(/ajoutée/)).toBeVisible()

  await expect.poll(() => imprimante.recu.join('')).toContain('^PQ15')
  await expect
    .poll(async () => (await (await request.get('/api/print-log')).json())[0]?.statut)
    .toBe('ok')
  const log = await (await request.get('/api/print-log')).json()
  expect(log[0]).toMatchObject({ template_nom: 'Impression e2e', quantite: 15, statut: 'ok' })
  imprimante.close()
})

test('étiquette carton : la quantité affichée est figée sur celle du modèle, non modifiable', async ({
  page,
  request,
}) => {
  const { id } = await (
    await request.post('/api/templates', { data: { nom: 'Carton figé e2e' } })
  ).json()
  await request.put(`/api/templates/${id}`, { data: { doc_json: doc, quantite_carton: 24 } })

  await page.goto('/')
  await page.getByTestId(`template-${id}`).click()
  await page.getByTestId('mode-carton').click()

  const affichage = page.getByTestId('quantite-carton')
  await expect(affichage).toHaveText('× 24')
  // ce n'est plus un champ de saisie : aucun input à l'intérieur
  await expect(affichage.locator('input')).toHaveCount(0)
})

test('IMPRIMER désactivé quand l’imprimante est déconnectée', async ({ page, request }) => {
  await request.put('/api/settings', { data: { printer_ip: '127.0.0.1', printer_port: '1' } })
  const { id } = await (
    await request.post('/api/templates', { data: { nom: 'KO e2e' } })
  ).json()
  await request.put(`/api/templates/${id}`, { data: { doc_json: doc } })

  await page.goto('/')
  await page.getByTestId(`template-${id}`).click()
  await expect(page.getByTestId('imprimer')).toBeDisabled()
})
