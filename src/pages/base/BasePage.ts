import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { Logger } from '../../utils/Logger';
import { WaitUtil } from '../../utils/WaitUtil';
import { ScreenshotUtil } from '../../utils/ScreenshotUtil';
import type { IBasePage, NavigateOptions, WaitOptions, ClickOptions, FillOptions } from '../../types';

/**
 * BasePage — foundation for all Page Objects.
 *
 * Provides:
 *  - Smart click / fill / select wrappers with built-in retry
 *  - Common wait patterns
 *  - Screenshot helpers
 *  - Allure step annotations (via parameter-passing approach)
 *  - Navigation abstractions
 */
export abstract class BasePage implements IBasePage {
  protected readonly logger = Logger.getLogger(this.constructor.name);

  constructor(public readonly page: Page) {}

  // ─── Navigation ──────────────────────────────────────────────────────────

  async navigate(url?: string, options: NavigateOptions = {}): Promise<void> {
    const target = url || this.getPageUrl();
    this.logger.info(`Navigating to: ${target}`);
    await this.page.goto(target, {
      waitUntil: options.waitUntil || 'domcontentloaded',
      timeout: options.timeout || 30_000,
    });
    await this.waitForPageLoad();
  }

  /**
   * Override in subclass to provide the page's canonical URL path.
   */
  protected getPageUrl(): string {
    return '/';
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ─── Page Info ────────────────────────────────────────────────────────────

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  getUrl(): string {
    return this.page.url();
  }

  // ─── Element Interactions ─────────────────────────────────────────────────

  /**
   * Click with optional retry and human-like delay.
   */
  async click(selector: string, options: ClickOptions = {}): Promise<void> {
    const { retries = 2, timeout = 15_000, force = false, ...playwrightOpts } = options;
    this.logger.debug(`Clicking: ${selector}`);
    await WaitUtil.retry(
      async () => {
        const locator = this.page.locator(selector).first();
        await locator.waitFor({ state: 'visible', timeout });
        await locator.click({ force, timeout, ...playwrightOpts });
        await WaitUtil.humanDelay(200, 500);
      },
      retries,
      500,
      `click(${selector})`,
    );
  }

  /**
   * Fill an input with optional clear-first and per-character delay.
   */
  async fill(
    selector: string,
    value: string,
    options: FillOptions = {},
  ): Promise<void> {
    const { timeout = 15_000, clearFirst = true, delay = 0 } = options;
    this.logger.debug(`Filling: ${selector} = "${value}"`);
    const locator = this.page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout });
    if (clearFirst) await locator.clear();
    if (delay > 0) {
      await locator.pressSequentially(value, { delay });
    } else {
      await locator.fill(value);
    }
  }

  /**
   * Type like a human (use for inputs with event listeners that don't fire on fill).
   */
  async typeHuman(selector: string, value: string, delayMs = 80): Promise<void> {
    this.logger.debug(`Human-typing into: ${selector}`);
    const locator = this.page.locator(selector).first();
    await locator.waitFor({ state: 'visible' });
    await locator.clear();
    await locator.pressSequentially(value, { delay: delayMs });
    await WaitUtil.humanDelay(300, 700);
  }

  async selectOption(selector: string, value: string): Promise<void> {
    this.logger.debug(`Selecting option: ${value} in ${selector}`);
    await this.page.locator(selector).selectOption(value);
  }

  async pressKey(key: string): Promise<void> {
    this.logger.debug(`Pressing key: ${key}`);
    await this.page.keyboard.press(key);
  }

  async hover(selector: string): Promise<void> {
    await this.page.locator(selector).first().hover();
  }

  // ─── Element Queries ──────────────────────────────────────────────────────

  async waitForElement(selector: string, options: WaitOptions = {}): Promise<Locator> {
    const locator = this.page.locator(selector);
    await locator.first().waitFor({
      state: options.state || 'visible',
      timeout: options.timeout || 15_000,
    });
    return locator;
  }

  async isElementVisible(selector: string, timeout = 5_000): Promise<boolean> {
    try {
      await this.page.locator(selector).first().waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async getElementText(selector: string): Promise<string> {
    return (await this.page.locator(selector).first().textContent()) || '';
  }

  async getAllElementTexts(selector: string): Promise<string[]> {
    return this.page.locator(selector).allTextContents();
  }

  async getElementCount(selector: string): Promise<number> {
    return this.page.locator(selector).count();
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    return this.page.locator(selector).first().getAttribute(attribute);
  }

  // ─── Scroll ───────────────────────────────────────────────────────────────

  async scrollToElement(selector: string): Promise<void> {
    this.logger.debug(`Scrolling to: ${selector}`);
    await this.page.locator(selector).first().scrollIntoViewIfNeeded();
  }

  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  async scrollToTop(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  // ─── Screenshots ──────────────────────────────────────────────────────────

  async takeScreenshot(name: string): Promise<string> {
    this.logger.info(`Taking screenshot: ${name}`);
    return ScreenshotUtil.takeFullPage(this.page, name);
  }

  // ─── Assertions ───────────────────────────────────────────────────────────

  async assertVisible(selector: string, message?: string): Promise<void> {
    await expect(this.page.locator(selector).first(), message).toBeVisible();
  }

  async assertHidden(selector: string, message?: string): Promise<void> {
    await expect(this.page.locator(selector).first(), message).toBeHidden();
  }

  async assertText(selector: string, expected: string | RegExp): Promise<void> {
    await expect(this.page.locator(selector).first()).toHaveText(expected);
  }

  async assertUrl(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  async assertTitle(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(pattern);
  }

  // ─── Dialog Handling ──────────────────────────────────────────────────────

  async acceptDialog(): Promise<void> {
    this.page.once('dialog', (dialog) => dialog.accept());
  }

  async dismissDialog(): Promise<void> {
    this.page.once('dialog', (dialog) => dialog.dismiss());
  }

  // ─── Cookies & Storage ───────────────────────────────────────────────────

  async clearCookies(): Promise<void> {
    await this.page.context().clearCookies();
  }

  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => localStorage.clear());
  }
}
