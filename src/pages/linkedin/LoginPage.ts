import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { WaitUtil } from '../../utils/WaitUtil';
import { config } from '../../config/ConfigManager';

/**
 * LoginPage — handles LinkedIn authentication.
 *
 * Also exposes a static `saveAuthState` method used in the Playwright
 * setup project to persist authenticated storage state.
 */
export class LoginPage extends BasePage {
  // Selectors
  private readonly EMAIL_INPUT = '#username, input[name="session_key"]';
  private readonly PASSWORD_INPUT = '#password, input[name="session_password"]';
  private readonly SIGN_IN_BTN = 'button[type="submit"], button[data-litms-control-urn*="login-submit"]';
  private readonly ERROR_MSG = '#error-for-username, div.alert--error, p.form__label--error';
  private readonly CAPTCHA_CHALLENGE = '#captcha-internal, .recaptcha-checkbox';
  private readonly VERIFY_PAGE = "h1:has-text(\"Let's do a quick verification\")";
  private readonly FEED_INDICATOR = 'div.feed-shared-news-module, div[data-view-name="feed-full-page"]';

  constructor(page: Page) {
    super(page);
  }

  protected getPageUrl(): string {
    return '/login';
  }

  /**
   * Log in with credentials from ConfigManager (or provided overrides).
   */
  async login(email?: string, password?: string): Promise<void> {
    const credentials = config.getCredentials();
    const userEmail = email || credentials.email;
    const userPassword = password || credentials.password;

    this.logger.info(`Logging in as: ${userEmail}`);

    await this.navigate();

    // Fill email
    await this.waitForElement(this.EMAIL_INPUT);
    await this.fill(this.EMAIL_INPUT, userEmail, { clearFirst: true });
    await WaitUtil.humanDelay(300, 600);

    // Fill password
    await this.fill(this.PASSWORD_INPUT, userPassword, { clearFirst: true });
    await WaitUtil.humanDelay(200, 500);

    // Submit
    await this.click(this.SIGN_IN_BTN);

    // Wait for navigation result
    await this.handlePostLogin();
  }

  private async handlePostLogin(): Promise<void> {
    // Wait for one of: feed, error, captcha, or verification
    try {
      await this.page.waitForURL(/\/(feed|checkpoint|login\/checkpoint)/, { timeout: 30_000 });
    } catch {
      // May redirect differently — check current state
    }

    const currentUrl = this.page.url();
    this.logger.info(`Post-login URL: ${currentUrl}`);

    if (currentUrl.includes('/feed')) {
      this.logger.info('Login successful — landed on feed');
      return;
    }

    if (await this.isElementVisible(this.ERROR_MSG, 3_000)) {
      const errText = await this.getElementText(this.ERROR_MSG);
      throw new Error(`Login failed: ${errText}`);
    }

    if (await this.isElementVisible(this.CAPTCHA_CHALLENGE, 3_000)) {
      throw new Error('Login blocked by CAPTCHA challenge — manual intervention required');
    }

    if (await this.isElementVisible(this.VERIFY_PAGE, 3_000)) {
      throw new Error('LinkedIn requires additional verification — check your email/phone');
    }

    // Fallback — wait for feed
    await this.waitForElement(this.FEED_INDICATOR, { timeout: 20_000 });
    this.logger.info('Login successful — feed detected');
  }

  /**
   * Verify we are on the feed (i.e. logged in successfully).
   */
  async assertLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL(/\/feed/, { timeout: 30_000 });
    this.logger.info('Asserted: user is logged in');
  }

  /**
   * Used by the Playwright global setup to persist auth state.
   */
  static async saveAuthState(page: Page, outputPath: string): Promise<void> {
    const loginPage = new LoginPage(page);
    await loginPage.login();
    await loginPage.assertLoggedIn();
    // Persist cookies/localStorage so tests can reuse the session
    await page.context().storageState({ path: outputPath });
    console.log(`[LoginPage] Auth state saved to: ${outputPath}`);
  }

  async isLoginPageVisible(): Promise<boolean> {
    return this.isElementVisible(this.EMAIL_INPUT);
  }
}
