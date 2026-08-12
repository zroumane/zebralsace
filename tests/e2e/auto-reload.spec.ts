import { test, expect } from '@playwright/test'

// window.location.reload est non reconfigurable (spec HTML, « unforgeable ») :
// impossible à intercepter côté page. On observe donc l'EFFET réel — une
// deuxième requête de document — plutôt que d'essayer d'espionner l'appel.

test('un nouveau déploiement détecté recharge automatiquement l’onglet', async ({ page }) => {
  let appelsPing = 0
  let requetesDocument = 0
  page.on('request', (r) => {
    if (r.resourceType() === 'document') requetesDocument++
  })
  await page.route('**/api/ping', async (route) => {
    appelsPing++
    await route.fulfill({ json: { ok: true, version: appelsPing === 1 ? '1.0.0' : '2.0.0' } })
  })
  await page.addInitScript(() => {
    ;(window as any).__intervalleAutoReloadTest = 200 // au lieu de 60 s, pour un test rapide
  })

  await page.goto('/')
  await expect(page.getByTestId('statut-imprimante')).toBeVisible()
  expect(requetesDocument).toBe(1) // seulement le chargement initial pour l'instant

  // 2e ping (200 ms plus tard) reçoit une version différente → rechargement automatique
  await expect.poll(() => requetesDocument, { timeout: 5000 }).toBe(2)
})

test('même version détectée en boucle : pas de rechargement', async ({ page }) => {
  let requetesDocument = 0
  page.on('request', (r) => {
    if (r.resourceType() === 'document') requetesDocument++
  })
  await page.route('**/api/ping', (route) => route.fulfill({ json: { ok: true, version: '1.0.0' } }))
  await page.addInitScript(() => {
    ;(window as any).__intervalleAutoReloadTest = 100
  })

  await page.goto('/')
  await expect(page.getByTestId('statut-imprimante')).toBeVisible()
  await page.waitForTimeout(1000) // largement plus que 10 cycles de vérification
  expect(requetesDocument).toBe(1)
})
