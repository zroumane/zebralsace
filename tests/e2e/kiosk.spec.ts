import { test, expect } from '@playwright/test'

test('grille et indicateur', async ({ page, request }) => {
  // un spec précédent peut avoir configuré une IP : on repart de zéro
  await request.put('/api/settings', { data: { printer_ip: '' } })
  const { id } = await (await request.post('/api/templates', { data: { nom: 'Modèle e2e' } })).json()

  await page.goto('/')
  await expect(page.getByTestId(`template-${id}`)).toContainText('Modèle e2e')
  // pas d'IP configurée → indicateur rouge explicite
  await expect(page.getByTestId('statut-imprimante')).toContainText('Imprimante indisponible')
  await expect(page.getByTestId('statut-imprimante')).toContainText('non configurée')
})
