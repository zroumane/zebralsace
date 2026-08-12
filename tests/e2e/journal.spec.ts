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
  await expect(page).toHaveURL(/\/admin\/historique$/) // l'onglet met l'URL à jour
  // seules les impressions réussies figurent dans l'historique
  await expect(page.getByTestId('table-historique')).toContainText('Journal ok')
  await expect(page.getByTestId('table-historique')).not.toContainText('Journal ko')
  await expect(page.getByTestId('table-historique')).not.toContainText('Statut')
  await expect(page.getByTestId('table-historique')).toContainText(/\d{2}\/\d{2}\/\d{4}/) // date JJ/MM/AAAA
  await expect(page.getByTestId('table-historique')).toContainText(/\d{2}:\d{2}/) // heure HH:MM

  await page.getByText('Erreurs').click()
  // même présentation que l'historique (date/heure séparées, filtres, export…), plus le motif
  await expect(page.getByTestId('table-erreurs')).toContainText('Journal ko')
  await expect(page.getByTestId('table-erreurs')).toContainText('injoignable') // colonne Motif
  await expect(page.getByTestId('table-erreurs')).not.toContainText('Journal ok')
  await expect(page.getByTestId('table-erreurs')).toContainText(/\d{2}\/\d{2}\/\d{4}/)
  await expect(page.getByTestId('table-erreurs')).toContainText(/\d{2}:\d{2}/)
  await expect(page.getByTestId('filtre-modele')).toBeVisible()
  await expect(page.getByTestId('exporter-excel')).toBeVisible()
})

test('historique : pagination à 20 lignes par page', async ({ page, request }) => {
  const imprimante = await startFakePrinter()
  await request.put('/api/settings', {
    data: { printer_ip: '127.0.0.1', printer_port: String(imprimante.port) },
  })
  for (let i = 0; i < 25; i++) {
    await request.post('/api/print', { data: { template_nom: `Pagination ${i}`, quantite: 1, png: PNG_1PX } })
  }
  await expect
    .poll(async () => (await (await request.get('/api/print-log')).json())[0]?.template_nom)
    .toBe('Pagination 24')
  imprimante.close()

  await page.goto('/admin')
  await page.getByText('Historique').click()
  await expect(page.locator('[data-testid="table-historique"] tbody tr')).toHaveCount(20)
  await expect(page.locator('.n-pagination')).toBeVisible()
})

test('historique : filtre par modèle et export Excel (CSV) de ce qui est affiché', async ({ page, request }) => {
  const imprimante = await startFakePrinter()
  await request.put('/api/settings', {
    data: { printer_ip: '127.0.0.1', printer_port: String(imprimante.port) },
  })
  await request.post('/api/print', { data: { template_nom: 'Filtre A', quantite: 5, png: PNG_1PX } })
  await expect
    .poll(async () => (await (await request.get('/api/print-log')).json())[0]?.template_nom)
    .toBe('Filtre A')
  await request.post('/api/print', { data: { template_nom: 'Filtre B', quantite: 2, png: PNG_1PX } })
  await expect
    .poll(async () => (await (await request.get('/api/print-log')).json())[0]?.template_nom)
    .toBe('Filtre B')
  imprimante.close()

  await page.goto('/admin')
  await page.getByText('Historique').click()
  await expect(page.getByTestId('table-historique')).toContainText('Filtre A')
  await expect(page.getByTestId('table-historique')).toContainText('Filtre B')

  await page.getByTestId('filtre-modele').click()
  await page.locator('.n-base-select-option__content', { hasText: 'Filtre A' }).click()
  await expect(page.getByTestId('table-historique')).toContainText('Filtre A')
  await expect(page.getByTestId('table-historique')).not.toContainText('Filtre B')

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('exporter-excel').click(),
  ])
  const chemin = await telechargement.path()
  const contenu = fs.readFileSync(chemin!, 'utf8')
  expect(contenu).toContain('Modèle') // en-tête
  expect(contenu).toContain('Filtre A')
  expect(contenu).not.toContain('Filtre B') // seulement ce qui est affiché (filtré)
})
