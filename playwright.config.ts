import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['./reporters/human-progress.js'], // Human-friendly progress & summary
    ['list'], // Keep detailed line output and rich failure formatting
    ['html', { open: 'never' }], // Generate HTML artifacts but never auto-open
    ['./reporters/open-report-if-single.js', { port: 9323, autoCloseSeconds: 8, openWithPlaywright: true, playwrightBrowser: 'chromium', openTimeoutSeconds: 30 }]
  ],
  // All test artifacts (screenshots, traces, videos) are stored by default in 'test-results'.
  // You can change this directory with `outputDir` if needed.
  outputDir: 'test-results',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

     /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
     trace: 'on-first-retry',
     /* Capture screenshots for every test run (passed or failed) so screenshots
       are available in the HTML report for passed tests as well.
       Note: this causes one screenshot per test (per browser), which may increase
       disk usage in `test-results`. Change back to `only-on-failure` if preferred.
     */
    // We will take manual screenshots in the fixture so disable Playwright auto screenshots
    // to avoid duplicate attachments. Set to 'only-on-failure' or 'on' if you prefer built-in behavior.
    screenshot: 'off',
     /* Optionally, capture video only on first retry; useful for debugging flaky failures */
     video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
