import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment-specific config
const env = process.env.TEST_ENV || 'dev';
dotenv.config({ path: path.resolve(__dirname, `src/config/environments/${env}.env`) });
dotenv.config({ path: path.resolve(__dirname, '.env') }); // local overrides

export default defineConfig({
  testDir: './tests',

  // Global test timeout
  timeout: 90_000,

  // Expect / assertion timeout
  expect: {
    timeout: 15_000,
  },

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Workers on CI
  workers: process.env.CI ? 4 : 3,

  // Reporter configuration
  reporter: [
    ['list', { printSteps: true }],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'allure-results',
        suiteTitle: true,
        environmentInfo: {
          os: process.platform,
          node_version: process.version,
          test_env: env,
          base_url: process.env.BASE_URL || 'https://www.linkedin.com',
        },
      },
    ],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['./src/reporters/PdfReporter.ts'],
    ['json', { outputFile: 'reports/test-results.json' }],
  ],

  // Shared settings for all projects
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'https://www.linkedin.com',

    // Capture screenshot only on failure
    screenshot: 'only-on-failure',

    // Record video only when retrying a test for the first time
    video: 'retain-on-failure',

    // Capture trace on failure
    trace: 'retain-on-failure',

    // Action timeout
    actionTimeout: 15_000,

    // Navigation timeout
    navigationTimeout: 30_000,

    // Run headless by default
    headless: process.env.HEADLESS !== 'true',

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },

    // Viewport
    viewport: { width: 1440, height: 900 },
  },

  // Configure projects for major browsers
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testDir: './src/fixtures',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use prepared auth state
        storageState: process.env.AUTH_STATE_FILE || 'reports/auth/linkedin-auth.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: process.env.AUTH_STATE_FILE || 'reports/auth/linkedin-auth.json',
      },
      dependencies: ['setup'],
    },

    // No-auth project for public page tests
    {
      name: 'chromium-no-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*smoke.*/,
    },
  ],

  // Folder for test artifacts
  outputDir: 'test-results/',

  // Global setup/teardown
  // globalSetup: './src/config/global-setup.ts',
  // globalTeardown: './src/config/global-teardown.ts',
});
