import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const doc = JSON.parse(fs.readFileSync('tests/e2e/fixtures/demo-template.json', 'utf8'))

test('le rendu du template de démo est identique au pixel près', async ({ page }) => {
  await page.goto('/')
  const dataUrl: string = await page.evaluate(
    ([d]) =>
      (window as any).__zebra.renderLabel(d, {
        widthMm: 100,
        heightMm: 50,
        dpi: 203,
        vars: { date: '01/02/2026', dlc: '15/02/2026' },
        baseDate: '2026-02-01',
        hideDlc: false,
      }),
    [doc]
  )
  // dimensions exactes : 100 mm → 799 px, 50 mm → 400 px à 203 dpi
  const dims = await page.evaluate(
    (u) =>
      new Promise<{ w: number; h: number }>((r) => {
        const img = new Image()
        img.onload = () => r({ w: img.naturalWidth, h: img.naturalHeight })
        img.src = u
      }),
    dataUrl
  )
  expect(dims).toEqual({ w: 799, h: 400 })
  expect(Buffer.from(dataUrl.split(',')[1], 'base64')).toMatchSnapshot('demo-label.png')
})

test('hideDlc retire la ligne DLC du rendu', async ({ page }) => {
  await page.goto('/')
  const [avec, sans]: string[] = await page.evaluate(
    ([d]) => {
      const opts = {
        widthMm: 100, heightMm: 50, dpi: 203,
        vars: { date: '01/02/2026', dlc: '15/02/2026' },
        baseDate: '2026-02-01',
      }
      return Promise.all([
        (window as any).__zebra.renderLabel(d, { ...opts, hideDlc: false }),
        (window as any).__zebra.renderLabel(d, { ...opts, hideDlc: true }),
      ])
    },
    [doc]
  )
  expect(avec).not.toBe(sans)
})
