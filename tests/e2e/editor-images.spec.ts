import { test, expect } from '@playwright/test'

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

test('upload optimisé, placement sur le canvas, persistance', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Images e2e' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await page.getByTestId('upload-image').setInputFiles({
    name: 'logo-test.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  })
  await expect(page.getByText('Image optimisée et ajoutée')).toBeVisible()

  const logos = await (await request.get('/api/logos')).json()
  const logo = logos.find((l: any) => l.nom === 'logo-test')
  expect(logo).toBeTruthy()

  await page.getByTestId(`logo-${logo.id}`).locator('img').click()
  await page.getByTestId('enregistrer').click()
  await expect(page.getByText('Modèle enregistré')).toBeVisible()

  const t = await (await request.get(`/api/templates/${id}`)).json()
  expect(t.doc_json).toContain('Image')
})
