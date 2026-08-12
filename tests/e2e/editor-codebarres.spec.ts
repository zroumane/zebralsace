import { test, expect } from '@playwright/test'

test('ajout d’un code-barres avec valeurs unité/carton distinctes, persistées', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'CB e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-code-barre').click()

  await page.getByTestId('cb-valeur-unite').locator('input').fill('400638133393')
  await page.getByTestId('cb-valeur-carton').locator('input').fill('500123456780')

  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  const t = await (await request.get(`/api/templates/${id}`)).json()
  const doc = JSON.parse(t.doc_json)
  const cb = doc.objects.find((o: any) => o.codeBarre)
  expect(cb).toBeTruthy()
  expect(cb.codeBarre.valeurUnite).toBe('400638133393')
  expect(cb.codeBarre.valeurCarton).toBe('500123456780')
})

test('le canevas de l’éditeur affiche toujours le repère 0…0, jamais la vraie valeur tapée', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'CB repère e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-code-barre').click()

  const canvasEl = page.locator('.zone-canvas canvas').last()
  const avant = await canvasEl.evaluate((el: HTMLCanvasElement) => el.toDataURL())

  await page.getByTestId('cb-valeur-unite').locator('input').fill('400638133393')
  await page.getByTestId('cb-valeur-carton').locator('input').fill('111111111117')
  await page.waitForTimeout(200)

  const apres = await canvasEl.evaluate((el: HTMLCanvasElement) => el.toDataURL())
  expect(apres).toBe(avant) // valeurs tapées jamais rendues sur le canevas
})

test('aperçu : la bascule unité/carton change le rendu affiché', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'CB aperçu e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-code-barre').click()
  await page.getByTestId('cb-valeur-unite').locator('input').fill('400638133393')
  await page.getByTestId('cb-valeur-carton').locator('input').fill('111111111117')

  await page.getByTestId('apercu-jour').click()
  const apercu = page.getByTestId('apercu-editeur')
  await expect(apercu).toBeVisible()
  const srcUnite = await apercu.getAttribute('src')

  await page.getByTestId('apercu-mode-carton').click()
  await expect.poll(() => apercu.getAttribute('src')).not.toBe(srcUnite)
})

test('le GTIN est le type par défaut, et une clé de contrôle erronée est tolérée', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'CB GTIN e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-code-barre').click()
  await expect(page.getByTestId('cb-type')).toContainText('GTIN')

  // 13 chiffres avec une clé de contrôle volontairement fausse : ne doit pas
  // faire échouer le rendu (la clé est recalculée à partir des 12 premiers)
  await page.getByTestId('cb-valeur-unite').locator('input').fill('4006381333934')
  await page.getByTestId('apercu-jour').click()
  await expect(page.getByTestId('apercu-editeur')).toBeVisible()
  await expect(page.getByText(/Code-barres invalide/)).not.toBeVisible()
})

test('valeur non numérique pour un EAN-13 → message d’erreur explicite à l’aperçu', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'CB EAN invalide e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-code-barre').click()
  await page.getByTestId('cb-type').click()
  await page.getByText('EAN-13').click()
  await page.getByTestId('cb-valeur-unite').locator('input').fill('ABCDEFGHIJKL')

  await page.getByTestId('apercu-jour').click()
  await expect(page.getByText(/Code-barres invalide/)).toBeVisible()
})
