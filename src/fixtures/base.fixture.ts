import { test as base, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { Logger } from '../utils/Logger';
import { ScreenshotUtil } from '../utils/ScreenshotUtil';
import { DataHelper } from '../utils/DataHelper';
import * as fs from 'fs';
import * as path from 'path';

const logger = Logger.getLogger('BaseFixture');

/**
 * Base fixture that extends Playwright's test with:
 *  - Auto-screenshot on failure
 *  - Allure test metadata injection
 *  - Logging hooks
 *  - Page setup (viewport, locale)
 *  - HTML capture on failure for self-healing pipeline
 */
export const test = base.extend<{
  /**
   * Convenience helper to attach a screenshot to the Allure report.
   */
  attachScreenshot: (name: string) => Promise<void>;

  /**
   * Convenience helper to add a step to the Allure report.
   */
  allureStep: (name: string, body: () => Promise<void>) => Promise<void>;
}>({

  // Override the default page fixture with enhanced setup
  page: async ({ page }, use, testInfo) => {
    const startTime = Date.now();
    logger.info(`▶ Starting test: "${testInfo.title}"`);

    // Attach allure metadata
    allure.label('testId', testInfo.testId);
    allure.label('retry', String(testInfo.retry));
    allure.label('browser', testInfo.project.name);
    allure.label('environment', process.env.TEST_ENV || 'dev');

    // Tag suite metadata
    allure.suite(testInfo.titlePath[0] || 'Suite');
    if (testInfo.titlePath[1]) {
      allure.parentSuite(testInfo.titlePath[1]);
    }

    // ─── Intercept console errors for diagnostics ─────────────────────────
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // ─── Track failed network requests ────────────────────────────────────
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
    });

    // ─── Run the test ──────────────────────────────────────────────────────
    await use(page);

    // ─── Post-test hooks ──────────────────────────────────────────────────
    const duration = Date.now() - startTime;
    const status = testInfo.status || 'unknown';

    logger.info(
      `■ Test "${testInfo.title}" ${status.toUpperCase()} in ${DataHelper.formatDuration(duration)}`,
    );

    // Attach console errors if any
    if (consoleErrors.length > 0) {
      allure.attachment(
        'Browser console errors',
        consoleErrors.join('\n'),
        'text/plain',
      );
    }

    // Attach failed network requests if any
    if (failedRequests.length > 0) {
      allure.attachment(
        'Failed network requests',
        failedRequests.join('\n'),
        'text/plain',
      );
    }

    // ─── On failure: capture screenshot + HTML for self-healing ───────────
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      logger.warn(`Test failed — capturing failure screenshot`);

      // Capture screenshot
      try {
        const screenshotPath = await ScreenshotUtil.takeFullPage(
          page,
          `FAILED_${DataHelper.sanitizeFilename(testInfo.title)}`,
        );
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        allure.attachment('Failure screenshot', screenshotBuffer, 'image/png');
        testInfo.attachments.push({
          name: 'failure-screenshot',
          path: screenshotPath,
          contentType: 'image/png',
        });
      } catch (screenshotErr) {
        logger.error('Failed to capture failure screenshot', { error: String(screenshotErr) });
      }

      // Capture page HTML for self-healing pipeline
      try {
        const html = await page.content();
        const htmlDir = path.join(process.cwd(), 'reports', 'html');
        if (!fs.existsSync(htmlDir)) {
          fs.mkdirSync(htmlDir, { recursive: true });
        }
        const safeTestId = testInfo.testId.replace(/[^a-z0-9]/gi, '_');
        const htmlPath = path.join(htmlDir, `${safeTestId}.html`);
        fs.writeFileSync(htmlPath, html);
        logger.info(`HTML captured for healer: ${htmlPath}`);
      } catch (htmlErr) {
        logger.error('Failed to capture page HTML', { error: String(htmlErr) });
      }
    }
  },

  // ─── Attach screenshot helper ──────────────────────────────────────────
  attachScreenshot: async ({ page }, use) => {
    const helper = async (name: string): Promise<void> => {
      const buffer = await page.screenshot({ fullPage: true });
      allure.attachment(name, buffer, 'image/png');
    };
    await use(helper);
  },

  // ─── Allure step helper ────────────────────────────────────────────────
  allureStep: async ({}, use) => {
    const helper = async (name: string, body: () => Promise<void>): Promise<void> => {
      await allure.step(name, body);
    };
    await use(helper);
  },
});

export { expect };