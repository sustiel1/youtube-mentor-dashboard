import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: 'http://localhost:5184',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Chromium only — fast and stable for smoke tests
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    port: 5184,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
