import { test, expect } from '@playwright/test'

test('poids unitaire : valeur par défaut, {{poids}} inséré, rendu différent à l’unité et au carton', async ({
  page,
  request,
}) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Poids e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()

  // champ par modèle, prérempli à 280 g
  await expect(page.getByTestId('ajouter-texte')).toBeEnabled()
  const champPoids = page.locator('label:has-text("Poids unitaire")').locator('input')
  await expect(champPoids).toHaveValue('280')

  // insertion de {{poids}} dans un bloc texte (double-clic sélectionne le mot "Texte")
  await page.getByTestId('ajouter-texte').click()
  const canvas = page.locator('.zone-canvas canvas').last()
  await canvas.dblclick({ position: { x: 100, y: 61 } })
  await page.getByText('{{poids}}', { exact: true }).click()

  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()
  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('{{poids}}')

  // aperçu à l'unité : "280 G"
  await page.getByTestId('apercu-jour').click()
  await expect(page.getByTestId('apercu-editeur')).toBeVisible()
  const srcUnite = await page.getByTestId('apercu-editeur').getAttribute('src')

  // aperçu carton : quantité (15 par défaut) × 280 g = 4200 g = "4,2 KG"
  await page.getByTestId('apercu-mode-carton').click()
  await expect
    .poll(() => page.getByTestId('apercu-editeur').getAttribute('src'))
    .not.toBe(srcUnite)
})
