import { test, expect } from '@playwright/test'

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

test('import nommé dans Médias puis placement depuis l’éditeur', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Images e2e' } })).json()

  // création dans l'onglet Médias, avec un nom choisi
  await page.goto('/admin')
  await page.getByText('Médias').click()
  await page.getByTestId('media-nom').locator('input').fill('Logo maison')
  await page.getByTestId('upload-image').setInputFiles({
    name: 'fichier-quelconque.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  })
  await expect(page.getByText('« Logo maison » ajouté')).toBeVisible()

  const logos = await (await request.get('/api/logos')).json()
  const logo = logos.find((l: any) => l.nom === 'Logo maison')
  expect(logo).toBeTruthy()

  // insertion depuis l'éditeur via la bibliothèque partagée
  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  await page.getByTestId(`logo-${logo.id}`).click()
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('Image')
})
