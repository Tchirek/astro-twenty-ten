import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', fullyParallel: true, workers: 2, retries: 0,
  forbidOnly: Boolean(process.env.CI), reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
