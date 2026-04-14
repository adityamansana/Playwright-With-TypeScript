import type { Page, Locator } from '@playwright/test';
import { Logger } from './Logger';

const logger = Logger.getLogger('WaitUtil');

/**
 * WaitUtil — centralised waiting utilities.
 * Provides smart waits beyond basic Playwright built-ins.
 */
export class WaitUtil {
  /**
   * Wait for a network request matching a URL pattern
   */
  static async waitForRequest(
    page: Page,
    urlPattern: string | RegExp,
    timeout = 30_000,
  ): Promise<void> {
    logger.debug(`Waiting for request matching: ${urlPattern}`);
    await page.waitForRequest(urlPattern, { timeout });
  }

  /**
   * Wait for a network response matching a URL pattern
   */
  static async waitForResponse(
    page: Page,
    urlPattern: string | RegExp,
    statusCode = 200,
    timeout = 30_000,
  ): Promise<void> {
    logger.debug(`Waiting for response: ${urlPattern} with status ${statusCode}`);
    await page.waitForResponse(
      (res) => {
        const urlMatch =
          typeof urlPattern === 'string'
            ? res.url().includes(urlPattern)
            : urlPattern.test(res.url());
        return urlMatch && res.status() === statusCode;
      },
      { timeout },
    );
  }

  /**
   * Wait for page to be stable (no pending network activity for 500ms)
   */
  static async waitForNetworkIdle(page: Page, timeout = 30_000): Promise<void> {
    logger.debug('Waiting for network idle');
    await page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Wait for element to be visible with retry logic
   */
  static async waitForElementVisible(
    locator: Locator,
    timeout = 15_000,
  ): Promise<void> {
    logger.debug('Waiting for element to be visible');
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for element text to contain expected value
   */
  static async waitForTextContent(
    locator: Locator,
    expectedText: string,
    timeout = 15_000,
  ): Promise<void> {
    logger.debug(`Waiting for text content: "${expectedText}"`);
    await locator.waitFor({ state: 'visible', timeout });
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const text = await locator.textContent();
      if (text?.includes(expectedText)) return;
      await WaitUtil.sleep(500);
    }
    throw new Error(`Text "${expectedText}" not found within ${timeout}ms`);
  }

  /**
   * Wait for URL to match pattern
   */
  static async waitForUrl(
    page: Page,
    urlPattern: string | RegExp,
    timeout = 30_000,
  ): Promise<void> {
    logger.debug(`Waiting for URL: ${urlPattern}`);
    await page.waitForURL(urlPattern, { timeout });
  }

  /**
   * Wait for count of elements to be at least N
   */
  static async waitForMinCount(
    locator: Locator,
    minCount: number,
    timeout = 30_000,
  ): Promise<void> {
    logger.debug(`Waiting for at least ${minCount} elements`);
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const count = await locator.count();
      if (count >= minCount) return;
      await WaitUtil.sleep(500);
    }
    const actual = await locator.count();
    throw new Error(`Expected at least ${minCount} elements, found ${actual} after ${timeout}ms`);
  }

  /**
   * Retry an async action up to N times
   */
  static async retry<T>(
    action: () => Promise<T>,
    retries = 3,
    delayMs = 1000,
    label = 'action',
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug(`Attempt ${attempt}/${retries} for: ${label}`);
        return await action();
      } catch (err) {
        lastError = err as Error;
        logger.warn(`Attempt ${attempt}/${retries} failed for "${label}": ${lastError.message}`);
        if (attempt < retries) await WaitUtil.sleep(delayMs * attempt);
      }
    }
    throw lastError;
  }

  /**
   * Wait for a condition function to return true
   */
  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeout = 30_000,
    interval = 500,
    label = 'condition',
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) return;
      await WaitUtil.sleep(interval);
    }
    throw new Error(`Condition "${label}" not met within ${timeout}ms`);
  }

  /**
   * Human-like delay to avoid bot detection
   */
  static async humanDelay(min = 500, max = 1500): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await WaitUtil.sleep(delay);
  }

  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
