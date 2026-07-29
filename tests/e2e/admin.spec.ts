import { test, expect } from '@playwright/test'

test('cycle de vie d\'un modèle depuis l\'admin', async ({ page, request }) => {
  await page.goto('/admin')
  await page.getByTestId('nouveau-modele').click()
  await expect(page).toHaveURL(/\/admin\/templates\/\d+/)
  const id = page.url().match(/templates\/(\d+)/)![1]

  // le nom se donne dans l'éditeur, puis on enregistre l'ébauche
  await page.getByTestId('nom-template').locator('input').fill('Oignons émincés')
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  await page.goto('/admin')
  const carte = page.getByTestId(`admin-template-${id}`)
  await expect(carte).toContainText('Oignons émincés')

  await carte.getByText('Dupliquer').click()
  // nom pré-rempli « … (copie) », modifiable avant validation
  await expect(page.getByTestId('champ-duplication').locator('input')).toHaveValue('Oignons émincés (copie)')
  await page.getByTestId('champ-duplication').locator('input').fill('Oignons géants')
  await page.getByTestId('valider-duplication').click()
  await expect(page.getByText('Oignons géants')).toBeVisible()

  await carte.getByText('Supprimer').click()
  await page.getByText('Supprimer', { exact: true }).last().click() // bouton du dialogue
  await expect(carte).not.toBeVisible()
})
