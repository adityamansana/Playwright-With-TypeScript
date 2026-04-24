import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { LoginPage } from '../../src/pages/linkedin/LoginPage';
import { WaitUtil } from '../../src/utils/WaitUtil';

/**
 * Smoke tests — run without authenticated state.
 * Verify basic connectivity and that LinkedIn is accessible.
 *
 * Mapped to `chromium-no-auth` project in playwright.config.ts.
 */
test.describe('Smoke Tests', () => {
  test.beforeEach(() => {
    allure.epic('LinkedIn Automation');
    allure.feature('Smoke / Health Check');
    allure.severity('blocker');
    allure.tag('smoke', 'no-auth');
  });

  test('SM-001: LinkedIn homepage should load successfully', async ({ page }) => {
    allure.story('Connectivity');
    allure.description('Verify LinkedIn is reachable and returns a valid page.');

    await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const title = await page.title();
    allure.parameter('Page title', title);

    expect(title, 'LinkedIn homepage title should be non-empty').toBeTruthy();
    expect(page.url(), 'Should be on linkedin.com').toContain('linkedin.com');
  });

  test('SM-002: LinkedIn login page should be accessible', async ({ page }) => {
    allure.story('Login Page Accessibility');
    allure.description('Verify the login page loads and shows the login form.');

    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    const isVisible = await loginPage.isLoginPageVisible();
    allure.parameter('Login form visible', String(isVisible));
    expect(isVisible, 'Login page email input should be visible').toBe(true);

    const title = await loginPage.getTitle();
    allure.parameter('Login page title', title);
    expect(title).toBeTruthy();
  });

  test('SM-003: Page response should be HTTP 200', async ({ page, request }) => {
    allure.story('HTTP Status');
    allure.description('Verify LinkedIn root returns HTTP 200.');

    const response = await request.get('https://www.linkedin.com');
    allure.parameter('HTTP status', String(response.status()));
    expect(response.status(), 'LinkedIn homepage should return HTTP 200').toBe(200);
  });

  test('SM-004: Login page form elements should be present', async ({ page }) => {
    allure.story('Login Form Elements');
    allure.description('Verify all key elements of the login form are rendered.');

    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
    await WaitUtil.sleep(1000);

    // Email input
    const emailInput = page.locator('#username, input[name="session_key"]').first();
    await expect(emailInput, 'Email input should be visible').toBeVisible({ timeout: 10_000 });

    // Password input
    const passwordInput = page.locator('#password, input[name="session_password"]').first();
    await expect(passwordInput, 'Password input should be visible').toBeVisible({ timeout: 10_000 });

    // Submit button
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn, 'Submit button should be visible').toBeVisible({ timeout: 10_000 });
  });
});
