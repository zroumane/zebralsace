import { test, expect } from '@playwright/test'

test('réglages et valeurs partagées persistent', async ({ page, request }) => {
  await page.goto('/admin')
  await page.getByText('Réglages').click()

  await page.getByTestId('ip').locator('input').fill('192.168.9.99')
  await page.getByTestId('enregistrer-reglages').click()
  await expect(page.getByText('Réglages enregistrés')).toBeVisible()
  const s = await (await request.get('/api/settings')).json()
  expect(s.printer_ip).toBe('192.168.9.99')

  await page.getByTestId('tester-connexion').click()
  await expect(page.getByText(/injoignable|imprimante/).first()).toBeVisible()

  // les valeurs partagées vivent désormais dans l'onglet Variables
  await page.getByText('Variables', { exact: true }).click()
  await page.getByTestId('nouvelle-cle').locator('input').fill('adresse')
  await page.getByTestId('nouvelle-valeur').locator('input').fill('12 rue des Lilas, Paris')
  await page.getByTestId('ajouter-globale').click()
  await expect(page.getByText('{{adresse}}')).toBeVisible()
})
