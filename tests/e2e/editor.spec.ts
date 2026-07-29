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
  await page.getByText('← Retour').click()
  await expect(page).toHaveURL(new RegExp(`/admin/templates/${id}`))
  expect(confirmVu).toBe(true)

  // après enregistrement, la sortie est libre
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()
  await page.getByText('← Retour').click()
  await expect(page).toHaveURL(/\/admin$/)
})
