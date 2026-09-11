import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/setup/auth.setup.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Turns off the Next dev-tools indicator, whose portal otherwise swallows
    // every click. Note reuseExistingServer: if a dev server is already up
    // WITHOUT this var, the suite attaches to it and the indicator is back.
    env: { E2E: '1' },
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
