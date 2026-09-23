import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    viewport: { width: 1440, height: 960 },
    launchOptions: fs.existsSync(localChrome) ? { executablePath: localChrome } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
