import { test, expect } from '@playwright/test'

test('ajout d’un bloc texte et persistance', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Texte e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-texte').click()
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('Textbox')
  expect(t.doc_json).not.toContain('estGrille') // la grille n'est jamais sérialisée
})

test('taper après une insertion de variable ne corrompt pas le texte', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Curseur e2e' } })).json()
  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-texte').click()
  // double-clic dans le bloc texte (posé à ~40,40px, fontSize ~24px, zoom 1)
  const canvas = page.locator('.zone-canvas canvas').last()
  // point situé dans le bloc texte quelle que soit la résolution configurée
  // (203 dpi : bloc à 40,40 haut ~28px ; 300 dpi : bloc à 59,59 haut ~41px)
  await canvas.dblclick({ position: { x: 100, y: 61 } }) // sélectionne le mot "Texte"
  await page.keyboard.type('ab') // remplace la sélection
  await page.getByText('{{date}}', { exact: true }).click()
  await page.keyboard.type('cd')
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()
  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('ab{{date}}cd')
})
