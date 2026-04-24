import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * global-setup.ts — runs once before the entire test suite.
 * Ensures required directories exist.
 * (Uncomment globalSetup in playwright.config.ts to enable.)
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const dirs = [
    'reports/auth',
    'reports/pdf',
    'reports/screenshots',
    'reports/logs',
    'allure-results',
    'test-results',
  ];

  for (const dir of dirs) {
    const full = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      console.log(`[global-setup] Created: ${dir}`);
    }
  }

  console.log('[global-setup] All directories ready.');
}

export default globalSetup;
