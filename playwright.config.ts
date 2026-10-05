import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

// Use /opt/pw-browsers when present (e.g. CI / container environments)
if (fs.existsSync('/opt/pw-browsers')) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use system Chrome if available on Windows, else Playwright's chromium
        channel: fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
          ? 'chrome'
          : undefined,
      },
    },
  ],
});
