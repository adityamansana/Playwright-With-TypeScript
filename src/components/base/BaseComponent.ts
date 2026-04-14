import type { Page, Locator } from '@playwright/test';
import { Logger } from '../../utils/Logger';
import type { IBaseComponent } from '../../types';

/**
 * BaseComponent — base class for all reusable UI components.
 *
 * A component wraps a portion of the page DOM (e.g., SearchBar, NavBar, ResultCard).
 * Components are instantiated inside Page Objects and expose focused, semantic APIs.
 */
export abstract class BaseComponent implements IBaseComponent {
  protected readonly logger = Logger.getLogger(this.constructor.name);
  protected readonly root: Locator;

  constructor(
    protected readonly page: Page,
    rootSelector: string,
  ) {
    this.root = page.locator(rootSelector).first();
  }

  async isVisible(): Promise<boolean> {
    try {
      await this.root.waitFor({ state: 'visible', timeout: 3_000 });
      return true;
    } catch {
      return false;
    }
  }

  async waitForVisible(timeout = 15_000): Promise<void> {
    await this.root.waitFor({ state: 'visible', timeout });
  }

  async waitForHidden(timeout = 15_000): Promise<void> {
    await this.root.waitFor({ state: 'hidden', timeout });
  }

  protected locator(selector: string): Locator {
    return this.root.locator(selector);
  }
}
