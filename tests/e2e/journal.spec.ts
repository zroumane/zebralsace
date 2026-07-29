import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { startFakePrinter } from './fakePrinter'

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

test('historique et erreurs affichent le journal', async ({ page, request }) => {
  // une impression ok…
  const imprimante = await startFakePrinter()
  await request.put('/api/settings', {
    data: { printer_ip: '127.0.0.1', printer_port: String(imprimante.port) },
  })
  await request.post('/api/print', {
    data: { template_nom: 'Journal ok', quantite: 3, png: PNG_1PX },
  })
  // la file est asynchrone : attendre que le job soit traité avant de couper l'imprimante
  // (on vise la ligne la plus récente — la base .e2e-data est partagée entre specs)
  await expect
    .poll(async () => (await (await request.get('/api/print-log')).json())[0]?.template_nom)
    .toBe('Journal ok')
  imprimante.close()
  // …et une en erreur (port fermé)
  await request.put('/api/settings', { data: { printer_port: '1' } })
  await request.post('/api/print', {
    data: { template_nom: 'Journal ko', quantite: 2, png: PNG_1PX },
  })
  await expect
    .poll(async () => (await (await request.get('/api/print-log')).json())[0]?.template_nom)
    .toBe('Journal ko')

  await page.goto('/admin')
  await page.getByText('Historique').click()
  await expect(page.getByTestId('table-historique')).toContainText('Journal ok')
  await expect(page.getByTestId('table-historique')).toContainText('Journal ko')

  await page.getByText('Erreurs').click()
  await expect(page.getByTestId('table-erreurs')).toContainText('Journal ko')
  await expect(page.getByTestId('table-erreurs')).toContainText('injoignable')
  await expect(page.getByTestId('table-erreurs')).not.toContainText('Journal ok')
})
