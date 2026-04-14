import type { Page } from '@playwright/test';
import { BaseComponent } from './base/BaseComponent';
import { WaitUtil } from '../utils/WaitUtil';

/**
 * SearchBar — wraps LinkedIn's global search input and autocomplete dropdown.
 */
export class SearchBar extends BaseComponent {
  // Selectors (LinkedIn-specific, may need updates for UI changes)
  private readonly INPUT = '[data-testid="typeahead-input"]';
  private readonly SUBMIT_BTN = 'button[type="submit"], button.search-global-typeahead__collapsed-search-button';
  private readonly SUGGESTIONS = 'div.search-global-typeahead__overlay li';
  private readonly CLEAR_BTN = 'button[aria-label="Clear search text"]';

  constructor(page: Page) {
    super(page, 'div.search-global-typeahead, header[id="global-nav"]');
  }

  /**
   * Type a search query and submit.
   */
  async search(query: string): Promise<void> {
    this.logger.info(`Searching for: "${query}"`);
    const input = this.page.locator(this.INPUT).first();
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await input.click();
    await input.clear();
    await input.pressSequentially(query, { delay: 80 });
    await WaitUtil.humanDelay(400, 800);
    await this.page.keyboard.press('Enter');
    this.logger.info('Search submitted');
  }

  /**
   * Type a query and wait for autocomplete suggestions.
   */
  async typeAndGetSuggestions(query: string): Promise<string[]> {
    const input = this.page.locator(this.INPUT).first();
    await input.click();
    await input.fill(query);
    await WaitUtil.sleep(1000);
    const suggestions = this.page.locator(this.SUGGESTIONS);
    const count = await suggestions.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await suggestions.nth(i).textContent();
      if (text) texts.push(text.trim());
    }
    return texts;
  }

  /**
   * Select a suggestion by index.
   */
  async selectSuggestion(index: number): Promise<void> {
    const suggestions = this.page.locator(this.SUGGESTIONS);
    await suggestions.nth(index).click();
  }

  /**
   * Clear the search input.
   */
  async clear(): Promise<void> {
    const clearBtn = this.page.locator(this.CLEAR_BTN);
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    } else {
      const input = this.page.locator(this.INPUT).first();
      await input.clear();
    }
  }

  async isInputVisible(): Promise<boolean> {
    return this.page.locator(this.INPUT).first().isVisible();
  }

  async getInputValue(): Promise<string> {
    return this.page.locator(this.INPUT).first().inputValue();
  }
}
