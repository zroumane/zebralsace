import { test, expect } from '@playwright/test'
import { startFakePrinter } from './fakePrinter'

test('impression de test depuis l’éditeur', async ({ page, request }) => {
  const imprimante = await startFakePrinter()
  await request.put('/api/settings', {
    data: { printer_ip: '127.0.0.1', printer_port: String(imprimante.port) },
  })
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Test édition' } })).json()

  await page.goto(`/admin/templates/${id}`)
  await expect(page.locator('.zone-canvas canvas').first()).toBeVisible()
  // le bouton d'impression de test vit dans le popup d'aperçu
  await page.getByTestId('apercu-jour').click()
  await page.getByTestId('imprimer-test').click()
  await expect(page.getByText('Étiquette de test envoyée')).toBeVisible()

  await expect.poll(() => imprimante.recu.join('')).toContain('^PQ1')
  await expect
    .poll(async () => (await (await request.get('/api/print-log')).json())[0]?.template_nom)
    .toBe('Test édition (test)')
  imprimante.close()
})
