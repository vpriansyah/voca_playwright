import { defineConfig, devices } from '@playwright/test';
import { ENV, RUN_ORDERS } from './tests/fixtures/env.ts';

/**
 * Environment (production / staging) dipilih lewat TEST_ENV; lihat tests/fixtures/env.ts dan .env.example.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Tests tagged @creates-order click Buy; they run only when RUN_ORDERS (or the environment default) allows it */
  grepInvert: RUN_ORDERS ? undefined : /@creates-order/,
  /* Production pages reset the form after load and respond slowly; 90 s per test */
  timeout: 90_000,
  /* Retry a failed test once */
  retries: 1,
  /* Keep running the remaining tests even when some fail */
  maxFailures: 0,
  /* One worker on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Separate report and artifacts per environment */
  reporter: [['html', { outputFolder: `playwright-report/${ENV.name}` }]],
  outputDir: `test-results/${ENV.name}`,
  /* Shown in the HTML report */
  metadata: { environment: ENV.name, origin: ENV.origin },

  use: {
    /* Per environment, see tests/fixtures/env.ts */
    headless: ENV.headless,
    /* Keep trace only for failed tests. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    /* Keep screenshot only for failed tests */
    screenshot: 'only-on-failure',
    /* Record every test; failed-test videos are deleted by the videoOnlyOnPass fixture in tests/fixtures/test.ts */
    video: 'on',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
