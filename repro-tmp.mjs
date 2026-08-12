import { chromium } from '@playwright/test'
import fs from 'node:fs'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const base = 'http://localhost:3183'
const dir = '/tmp/claude-1000/-home-zephyr-Dev-zebralsace/0cd90a53-68cb-4498-aebb-f2c43ea0d9ab/scratchpad'

const doc = fs.readFileSync('tests/e2e/fixtures/demo-template.json', 'utf8')
const { id } = await (await page.request.post(`${base}/api/templates`, { data: { nom: 'Repro popup 3' } })).json()
await page.request.put(`${base}/api/templates/${id}`, { data: { doc_json: doc, quantite_carton: 24 } })

await page.goto(`${base}/`)
await page.getByTestId(`template-${id}`).click()
await page.getByTestId('mode-carton').click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${dir}/popup-carton-final.png` })

await browser.close()
