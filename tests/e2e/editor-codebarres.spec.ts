import { test, expect } from '@playwright/test'

test('génère un EAN-13 nommé dans Médias et l’insère dans un modèle', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'CB e2e' } })).json()

  await page.goto('/admin')
  await page.getByText('Médias').click()
  await page.getByTestId('cb-nom').locator('input').fill('EAN test')
  await page.getByTestId('cb-valeur').locator('input').fill('123456789012')
  await page.getByTestId('cb-generer').click()
  await expect(page.getByText('« EAN test » ajouté')).toBeVisible()

  const logos = await (await request.get('/api/logos')).json()
  const cb = logos.find((l: any) => l.nom === 'EAN test')
  expect(cb).toBeTruthy()
  expect(cb.type).toBe('code-barres')

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId(`logo-${cb.id}`).click()
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('Image')
})

test('valeur EAN invalide → erreur, rien d’ajouté à la bibliothèque', async ({ page, request }) => {
  await page.goto('/admin')
  await page.getByText('Médias').click()
  await page.getByTestId('cb-nom').locator('input').fill('Mauvais EAN')
  await page.getByTestId('cb-valeur').locator('input').fill('123')
  await page.getByTestId('cb-generer').click()
  await expect(page.getByText(/Code-barres invalide/)).toBeVisible()

  const logos = await (await request.get('/api/logos')).json()
  expect(logos.find((l: any) => l.nom === 'Mauvais EAN')).toBeUndefined()
})
