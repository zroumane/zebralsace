import { test, expect } from '@playwright/test'

test('le kiosque affiche des sections par catégorie, ordonnées par position', async ({ page, request }) => {
  const creer = async (nom: string, categorie: string, position: number) => {
    const { id } = await (await request.post('/api/templates', { data: { nom } })).json()
    await request.put(`/api/templates/${id}`, { data: { categorie, position } })
    return id
  }
  const second = await creer('Section e2e second', 'Section e2e', 2)
  const premier = await creer('Section e2e premier', 'Section e2e', 1)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Section e2e' })).toBeVisible()

  // dans la section, la position définit l'ordre (1 avant 2, malgré l'ordre de création)
  const cartes = page.locator(`[data-testid="template-${premier}"], [data-testid="template-${second}"]`)
  await expect(cartes).toHaveCount(2)
  await expect(cartes.nth(0)).toContainText('Section e2e premier')
  await expect(cartes.nth(1)).toContainText('Section e2e second')
})
