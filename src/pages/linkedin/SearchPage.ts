import type { Page } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { SearchBar } from '../../components/SearchBar';
import { NavigationBar } from '../../components/NavigationBar';
import { WaitUtil } from '../../utils/WaitUtil';
import type { SearchQuery } from '../../types';

/**
 * SearchPage — represents the LinkedIn home feed / entry point for search.
 *
 * Responsibilities:
 *  - Initiate a global search via the SearchBar component
 *  - Verify user is on a state where search is possible (authenticated feed)
 */
export class SearchPage extends BasePage {
  readonly searchBar: SearchBar;
  readonly navBar: NavigationBar;

  // Feed-specific selectors
  private readonly FEED_CONTAINER = '[data-testid="mainFeed"]';
  private readonly CREATE_POST_BTN = '[aria-label="Start a post"]';
  private readonly SEARCH_INPUT = '[data-testid="typeahead-input"]';

  constructor(page: Page) {
    super(page);
    this.searchBar = new SearchBar(page);
    this.navBar = new NavigationBar(page);
  }

  protected getPageUrl(): string {
    return '/feed/';
  }

  /**
   * Navigate to the home feed and wait for it to be ready.
   */
  async goToFeed(): Promise<void> {
    this.logger.info('Navigating to LinkedIn feed');
    await this.navigate('/feed/');
    await this.waitForFeed();
  }

  private async waitForFeed(): Promise<void> {
    // LinkedIn feed has varying load patterns — use multiple fallback checks
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
      await WaitUtil.humanDelay(1000, 2000);
    } catch {
      this.logger.warn('Feed load state timeout — continuing anyway');
    }
  }

  /**
   * Perform a search from the current page using the global search bar.
   * Returns after submitting; caller navigates to SearchResultsPage.
   */
  async search(query: string | SearchQuery): Promise<void> {
    const keyword = typeof query === 'string' ? query : query.keyword;
    this.logger.info(`Initiating search: "${keyword}"`);

    // Ensure search input is available
    await this.waitForElement(this.SEARCH_INPUT, { timeout: 15_000 });
    await WaitUtil.humanDelay(300, 700);

    await this.searchBar.search(keyword);

    // Wait for URL to indicate search results
    try {
      await this.page.waitForURL(/\/search\/results/, { timeout: 20_000 });
      this.logger.info('Search results page loaded');
    } catch {
      this.logger.warn('URL did not change to /search/results — current URL: ' + this.page.url());
    }
  }

  /**
   * Verify the page is the feed (authenticated landing page).
   */
  async assertOnFeed(): Promise<void> {
    await this.assertUrl(/\/(feed|in\/)/, );
    this.logger.info('Confirmed on feed page');
  }

  async isFeedVisible(): Promise<boolean> {
    return this.isElementVisible(this.FEED_CONTAINER, 5_000);
  }

  async isSearchBarVisible(): Promise<boolean> {
    return this.searchBar.isInputVisible();
  }
}
