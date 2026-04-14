import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';

const logger = Logger.getLogger('ScreenshotUtil');

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'reports/screenshots');

export class ScreenshotUtil {
  static ensureDir(dir = SCREENSHOT_DIR): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * Take a full-page screenshot and save it with a timestamped name.
   * Returns the absolute path to the saved file.
   */
  static async takeFullPage(page: Page, name: string): Promise<string> {
    ScreenshotUtil.ensureDir();
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${sanitized}_${timestamp}.png`;
    const filePath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filePath, fullPage: true });
    logger.info(`Screenshot saved: ${filePath}`);
    return filePath;
  }

  /**
   * Take a viewport-only screenshot.
   */
  static async takeViewport(page: Page, name: string): Promise<string> {
    ScreenshotUtil.ensureDir();
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${sanitized}_viewport_${timestamp}.png`;
    const filePath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filePath, fullPage: false });
    logger.info(`Viewport screenshot saved: ${filePath}`);
    return filePath;
  }

  /**
   * Take a screenshot of a specific element.
   */
  static async takeElement(
    page: Page,
    selector: string,
    name: string,
  ): Promise<string> {
    ScreenshotUtil.ensureDir();
    const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${sanitized}_element_${timestamp}.png`;
    const filePath = path.join(SCREENSHOT_DIR, filename);
    const element = page.locator(selector).first();
    await element.screenshot({ path: filePath });
    logger.info(`Element screenshot saved: ${filePath}`);
    return filePath;
  }

  /**
   * Read screenshot as base64 string (for embedding in reports).
   */
  static toBase64(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
  }
}
