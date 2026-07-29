import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1, // les specs partagent .e2e-data et mutent printer_ip : jamais en parallèle
  use: { baseURL: 'http://localhost:3100' },
  expect: { toMatchSnapshot: { maxDiffPixels: 0 } },
  webServer: {
    command: 'rm -rf .e2e-data && npm run build && DATA_DIR=.e2e-data PORT=3100 npx tsx server/index.ts',
    url: 'http://localhost:3100/api/ping',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
