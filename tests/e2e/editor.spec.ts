import { test, expect } from '@playwright/test'

test('éditeur : chargement, renommage, sauvegarde avec vignette', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Édition e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()

  await page.getByTestId('nom-template').locator('input').fill('Édition e2e v2')
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.nom).toBe('Édition e2e v2')
  expect(t.vignette_png).toMatch(/^data:image\/png/)
})

test('annuler / rétablir', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Undo e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-texte').click()
  await page.getByTestId('annuler').click()
  await page.getByTestId('enregistrer').click()
  await expect
    .poll(async () => (await (await request.get(`/api/templates/${id}`)).json()).doc_json)
    .not.toContain('Textbox')

  await page.getByTestId('retablir').click()
  await page.getByTestId('enregistrer').click()
  await expect
    .poll(async () => (await (await request.get(`/api/templates/${id}`)).json()).doc_json)
    .toContain('Textbox')
})

test('tableau nutritionnel : insertion, persistance, réédition pré-remplie', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Nutrition e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-tableau').click()
  await page.getByTestId('nut-energie').locator('input').fill('217,57 kcal / 912,57 kJ')
  await page.getByTestId('nut-lipides').locator('input').fill('10,33 g')
  await page.getByTestId('valider-tableau').click()
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  let t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('tableauNutritionnel')
  expect(t.doc_json).toContain('217,57 kcal')

  // réédition : sélectionner le tableau sur le canvas → bouton pré-rempli
  await page.locator('.zone-canvas canvas').last().click({ position: { x: 200, y: 120 } })
  await page.getByTestId('modifier-tableau').click()
  await expect(page.getByTestId('nut-energie').locator('input')).toHaveValue('217,57 kcal / 912,57 kJ')
  await page.getByTestId('nut-energie').locator('input').fill('300 kcal / 1255 kJ')
  await page.getByTestId('valider-tableau').click()
  await page.getByTestId('enregistrer').click()
  // poll : le toast du 1er enregistrement peut encore être affiché, on attend l'API
  await expect
    .poll(async () => (await (await request.get(`/api/templates/${id}`)).json()).doc_json)
    .toContain('300 kcal')
  t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).not.toContain('217,57 kcal')
})

test('rectangle plein à bords arrondis : ajouté et persisté', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Rect e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-rectangle').click()
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('"rx"') // bords arrondis sérialisés
})

test('nouveau modèle jamais enregistré : quitter le supprime (après confirmation)', async ({ page, request }) => {
  await page.goto('/admin/modeles')
  await page.getByTestId('nouveau-modele').click()
  await expect(page).toHaveURL(/\?neuf=1$/)
  const id = page.url().match(/templates\/(\d+)/)![1]

  page.once('dialog', (d) => void d.accept())
  await page.getByTestId('retour').click()
  await expect(page).toHaveURL(/\/admin\/modeles$/)
  // l'ébauche a été supprimée
  await expect.poll(async () => (await request.get(`/api/templates/${id}`)).status()).toBe(404)
})

test('garde-fou : avertit avant de quitter avec des modifications non enregistrées', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Garde e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-texte').click()

  // navigation interne → confirm natif ; refuser = rester sur la page
  let confirmVu = false
  page.once('dialog', (d) => {
    confirmVu = true
    void d.dismiss()
  })
  await page.getByTestId('retour').click()
  await expect(page).toHaveURL(new RegExp(`/admin/templates/${id}`))
  expect(confirmVu).toBe(true)

  // après enregistrement, la sortie est libre
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()
  await page.getByTestId('retour').click()
  await expect(page).toHaveURL(/\/admin\/modeles$/)
})
