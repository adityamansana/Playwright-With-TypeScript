import { FullConfig } from '@playwright/test';

/**
 * global-teardown.ts — runs once after the entire test suite.
 * Use for cleanup, notification, or metric publishing.
 * (Uncomment globalTeardown in playwright.config.ts to enable.)
 */
async function globalTeardown(_config: FullConfig): Promise<void> {
  console.log('[global-teardown] Test run complete.');
  // Example: send Slack notification, upload reports to S3, etc.
}

export default globalTeardown;
