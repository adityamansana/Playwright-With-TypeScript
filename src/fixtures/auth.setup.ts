import { test as setup } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load env files relative to project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'src/config/environments/dev.env') });

const AUTH_STATE_PATH = path.resolve(
  process.cwd(),
  process.env.AUTH_STATE_FILE || 'reports/auth/linkedin-auth.json',
);

/**
 * auth.setup.ts — Playwright "setup" project.
 *
 * Runs ONCE before all tests (via `dependencies: ['setup']` in playwright.config.ts).
 * Logs in to LinkedIn and saves authenticated storage state (cookies + localStorage)
 * so all subsequent test projects reuse the session without logging in every run.
 *
 * Run standalone:  npx playwright test --project=setup
 */
setup('Authenticate with LinkedIn', async ({ page }) => {
  // Ensure output directory exists
  const authDir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
    console.log(`[setup] Created auth directory: ${authDir}`);
  }

  // Skip if fresh auth state already exists (< 12 hours old)
  if (fs.existsSync(AUTH_STATE_PATH)) {
    const stats = fs.statSync(AUTH_STATE_PATH);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    if (ageHours < 12) {
      console.log(
        `[setup] Reusing existing auth state (${ageHours.toFixed(1)}h old): ${AUTH_STATE_PATH}`,
      );
      return;
    }
    console.log(`[setup] Auth state is stale (${ageHours.toFixed(1)}h old) — refreshing`);
  }

  // Validate credentials
  const email = process.env.LINKEDIN_EMAIL || '';
  const password = process.env.LINKEDIN_PASSWORD || '';

  if (!email || !password) {
    throw new Error(
      '[setup] LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in .env\n' +
        '  Copy .env.example → .env and fill in your credentials.',
    );
  }

  console.log(`[setup] Logging in as: ${email.substring(0, 4)}****`);

  // Navigate to login page
  await page.goto('https://www.linkedin.com/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  // Fill email
  const emailInput = page.locator('#username, input[name="session_key"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill(email);
  await page.waitForTimeout(400);

  // Fill password
  const passwordInput = page.locator('#password, input[name="session_password"]').first();
  await passwordInput.fill(password);
  await page.waitForTimeout(300);

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  // Wait for post-login state
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log(`[setup] Post-login URL: ${currentUrl}`);

// Check for error messages — use first() or check all matching elements
  const errorLocators = page.locator('#error-for-username, div.alert--error, .form__label--error');
  const count = await errorLocators.count();
  for (let i = 0; i < count; i++) {
    const el = errorLocators.nth(i);
    if (await el.isVisible()) {
      const errText = await el.textContent();
      throw new Error(`[setup] Login failed: ${errText?.trim()}`);
    }
  }
  
  // Check for CAPTCHA or verification challenge
  if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
    throw new Error(
      '[setup] LinkedIn triggered a security challenge.\n' +
        '  Set HEADLESS=false in .env, run npx playwright test --project=setup, and complete it manually.',
    );
  }

  // Wait for feed or any authenticated page
  try {
    await page.waitForURL(/\/(feed|in\/)/, { timeout: 20_000 });
  } catch {
    const navVisible = await page
      .locator('header#global-nav, nav[aria-label="Global navigation"]')
      .first()
      .isVisible();

    if (!navVisible) {
      await page.screenshot({ path: path.join(authDir, 'setup-failure.png') });
      throw new Error(
        `[setup] Login did not reach the feed. Current URL: ${page.url()}\n` +
          `  Screenshot saved to: ${path.join(authDir, 'setup-failure.png')}`,
      );
    }
  }

  // Save storage state
  await page.context().storageState({ path: AUTH_STATE_PATH });
  console.log(`[setup] ✓ Auth state saved to: ${AUTH_STATE_PATH}`);
});
