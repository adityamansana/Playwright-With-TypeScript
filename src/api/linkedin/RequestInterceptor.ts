import type { Page, Request, Response, Route } from '@playwright/test';
import { Logger } from '../../utils/Logger';

const logger = Logger.getLogger('RequestInterceptor');

/**
 * RequestInterceptor — attach to a Playwright Page to spy on, block,
 * or mock network requests. Useful for validating API calls fired by the UI.
 *
 * Usage:
 *   const interceptor = new RequestInterceptor(page);
 *   interceptor.watch(/voyager\/api\/search/);
 *   await searchPage.search('engineer');
 *   const reqs = interceptor.getCaptured(/search/);
 *   expect(reqs.length).toBeGreaterThan(0);
 */
export class RequestInterceptor {
  private readonly captured: CapturedRequest[] = [];
  private readonly activeRoutes: string[] = [];

  constructor(private readonly page: Page) {
    // Passive request watcher (does not intercept, just logs)
    this.page.on('request', (req) => {
      logger.debug(`→ ${req.method()} ${req.url()}`);
    });

    this.page.on('response', (res) => {
      logger.debug(`← ${res.status()} ${res.url()} (${res.request().method()})`);
    });
  }

  /**
   * Start capturing all requests/responses matching a URL pattern.
   */
  watch(urlPattern: string | RegExp): void {
    this.page.on('response', async (res: Response) => {
      const url = res.url();
      const matches =
        typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);

      if (matches) {
        let body: string | undefined;
        try {
          body = await res.text();
        } catch {
          body = undefined;
        }

        this.captured.push({
          url,
          method: res.request().method(),
          status: res.status(),
          responseBody: body,
          timestamp: new Date(),
        });

        logger.info(`[Interceptor] Captured: ${res.request().method()} ${url} → ${res.status()}`);
      }
    });
  }

  /**
   * Mock a URL pattern to return a fixed response body.
   */
  async mock(
    urlPattern: string | RegExp,
    responseBody: unknown,
    status = 200,
  ): Promise<void> {
    const pattern = typeof urlPattern === 'string' ? `**${urlPattern}**` : urlPattern;
    await this.page.route(pattern, (route: Route) => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(responseBody),
      });
    });
    logger.info(`[Interceptor] Mock registered for: ${urlPattern}`);
  }

  /**
   * Block requests matching the pattern (simulate network failure).
   */
  async block(urlPattern: string | RegExp): Promise<void> {
    const pattern = typeof urlPattern === 'string' ? `**${urlPattern}**` : urlPattern;
    await this.page.route(pattern, (route: Route) => {
      route.abort('failed');
    });
    logger.info(`[Interceptor] Blocking requests for: ${urlPattern}`);
  }

  /**
   * Get all captured requests matching an optional filter.
   */
  getCaptured(filter?: string | RegExp): CapturedRequest[] {
    if (!filter) return [...this.captured];
    return this.captured.filter(({ url }) =>
      typeof filter === 'string' ? url.includes(filter) : filter.test(url),
    );
  }

  /**
   * Clear captured requests.
   */
  clear(): void {
    this.captured.length = 0;
  }

  /**
   * Assert that at least one request matching the pattern was captured.
   */
  assertCaptured(pattern: string | RegExp, message?: string): void {
    const matches = this.getCaptured(pattern);
    if (matches.length === 0) {
      throw new Error(
        message || `Expected at least one request matching ${pattern}, but none were captured`,
      );
    }
  }

  /**
   * Assert a specific status was returned for a captured request.
   */
  assertStatus(pattern: string | RegExp, expectedStatus: number): void {
    const matches = this.getCaptured(pattern);
    if (matches.length === 0) {
      throw new Error(`No requests captured for pattern: ${pattern}`);
    }
    const hasExpected = matches.some((r) => r.status === expectedStatus);
    if (!hasExpected) {
      const actual = matches.map((r) => r.status).join(', ');
      throw new Error(
        `Expected status ${expectedStatus} for ${pattern}, got: ${actual}`,
      );
    }
  }
}

export interface CapturedRequest {
  url: string;
  method: string;
  status: number;
  responseBody?: string;
  timestamp: Date;
}
