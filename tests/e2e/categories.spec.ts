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

test('drag & drop dans l’admin : déposer un modèle dans une catégorie créée', async ({ page, request }) => {
  const { id } = await (await request.post('/api/templates', { data: { nom: 'DnD e2e' } })).json()

  await page.goto('/admin')
  await page.getByTestId('nouvelle-categorie').click()
  await page.getByTestId('champ-categorie').locator('input').fill('Glissée e2e')
  await page.getByTestId('valider-categorie').click()
  await expect(page.getByTestId('categorie-Glissée e2e')).toBeVisible()

  await page.dragAndDrop(
    `[data-testid="admin-template-${id}"]`,
    '[data-testid="categorie-Glissée e2e"]'
  )
  await expect
    .poll(async () => (await (await request.get(`/api/templates/${id}`)).json()).categorie)
    .toBe('Glissée e2e')
})

test('flèches : remonter une catégorie change l’ordre des sections', async ({ page, request }) => {
  const creer = async (nom: string, categorie: string) => {
    const { id } = await (await request.post('/api/templates', { data: { nom } })).json()
    await request.put(`/api/templates/${id}`, { data: { categorie } })
  }
  await creer('Flèche A e2e', 'Flèche Alpha e2e')
  await creer('Flèche B e2e', 'Flèche Beta e2e')

  await page.goto('/admin/modeles')
  await page.getByTestId('cat-monter-Flèche Beta e2e').click()
  await expect
    .poll(async () => {
      const cats = (await (await request.get('/api/templates')).json()).map((t: any) => t.categorie)
      return cats.indexOf('Flèche Beta e2e') < cats.indexOf('Flèche Alpha e2e')
    })
    .toBe(true)
})
