import { test, expect } from '@playwright/test'

test('génère un EAN-13 et le sauvegarde comme image', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Code-barres e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-code-barres').click()
  await page.getByTestId('cb-valeur').locator('input').fill('123456789012')
  await page.getByTestId('cb-generer').click()

  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()
  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('Image')
})

test('valeur EAN invalide → erreur, rien d’inséré', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'CB invalide e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId('ajouter-code-barres').click()
  await page.getByTestId('cb-valeur').locator('input').fill('123')
  await page.getByTestId('cb-generer').click()
  await expect(page.getByText(/Code-barres invalide/)).toBeVisible()

  await page.keyboard.press('Escape') // ferme le modal
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()
  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).not.toContain('Image')
})
