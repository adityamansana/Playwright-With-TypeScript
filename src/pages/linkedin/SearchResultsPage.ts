import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../base/BasePage';
import { ResultCard } from '../../components/ResultCard';
import { FilterPanel } from '../../components/FilterPanel';
import { NavigationBar } from '../../components/NavigationBar';
import { WaitUtil } from '../../utils/WaitUtil';
import type { SearchResultsData, SearchResult } from '../../types';

/**
 * SearchResultsPage — LinkedIn search results (SERP).
 *
 * Responsibilities:
 *  - Parse and expose result cards via ResultCard components
 *  - Expose filter interactions via FilterPanel
 *  - Provide rich assertions for test layer consumption
 *  - Handle pagination
 */
export class SearchResultsPage extends BasePage {
  readonly filterPanel: FilterPanel;
  readonly navBar: NavigationBar;

  // Selectors — LinkedIn SERP as of 2024; selector alternatives handle UI variations
  private readonly RESULTS_LIST = '[class="search-results-container"]';
  private readonly RESULT_ITEMS = '[data-view-name="search-entity-result-universal-template"]';
  private readonly RESULT_COUNT_TEXT =
    'div.search-results-container h2, h1.pb2, p.display-flex.t-12';
  private readonly NO_RESULTS_MSG =
    'div.search-no-results__container, h2:has-text("No results found")';
  private readonly PAGINATION_NEXT_BTN =
    'button[aria-label="Next"], li.artdeco-pagination__button--next button';
  private readonly PAGINATION_CURRENT =
    'li.artdeco-pagination__indicator--number.active button, button[aria-current="true"]';
  private readonly LOADING_SPINNER =
    'div.artdeco-loader--active, svg[class*="artdeco-spinner"]';
  private readonly PEOPLE_FILTER_BTN =
    'button[aria-label*="People"], a[href*="search/results/people"]';
  private readonly SEARCH_HEADER =
    'h2.pb2, .search-results-container h1, h1[aria-label*="results"]';
  private readonly SPELL_CHECK_SUGGESTION =
    'p.spellcheck__suggestion a, a[href*="spellcheck"]';

  constructor(page: Page) {
    super(page);
    this.filterPanel = new FilterPanel(page);
    this.navBar = new NavigationBar(page);
  }

  // ─── Waits ─────────────────────────────────────────────────────────────────

  /**
   * Wait for the SERP to be fully loaded — results visible or no-results state.
   */
  async waitForResults(timeout = 30_000): Promise<void> {
    this.logger.info('Waiting for search results to load');

    // First wait for loading spinner to disappear
    try {
      await this.page.locator(this.LOADING_SPINNER).waitFor({ state: 'hidden', timeout: 10_000 });
    } catch {
      // Spinner may not appear at all
    }

    // Then wait for one of: results list or no-results
    await Promise.race([
      this.page.locator(this.RESULTS_LIST).first().waitFor({ state: 'visible', timeout }),
      this.page.locator(this.NO_RESULTS_MSG).first().waitFor({ state: 'visible', timeout }),
    ]);

    await WaitUtil.humanDelay(500, 1000);
    this.logger.info('Search results page is ready');
  }

  // ─── Assertions ────────────────────────────────────────────────────────────

  async assertOnResultsPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/search\/results/, { timeout: 20_000 });
    this.logger.info('Asserted: on search results page');
  }

  async assertHasResults(): Promise<void> {
    const hasResults = await this.hasResults();
    expect(hasResults, 'Expected search results to be present').toBe(true);
    this.logger.info('Asserted: results are present');
  }

  async assertNoResults(): Promise<void> {
    await expect(this.page.locator(this.NO_RESULTS_MSG).first()).toBeVisible({ timeout: 10_000 });
    this.logger.info('Asserted: no results state');
  }

  async assertResultCountAtLeast(minCount: number): Promise<void> {
    const count = await this.getResultCount();
    expect(count, `Expected at least ${minCount} results, got ${count}`).toBeGreaterThanOrEqual(minCount);
    this.logger.info(`Asserted: at least ${minCount} results (found ${count})`);
  }

  async assertResultContainsKeyword(keyword: string): Promise<void> {
    const results = await this.getResultsData();
    const keywordLower = keyword.toLowerCase();
    const hasMatch = results.results.some(
      (r) =>
        r.name.toLowerCase().includes(keywordLower) ||
        (r.title || '').toLowerCase().includes(keywordLower) ||
        (r.company || '').toLowerCase().includes(keywordLower),
    );
    expect(hasMatch, `No results contain keyword "${keyword}"`).toBe(true);
    this.logger.info(`Asserted: at least one result contains keyword "${keyword}"`);
  }

  async assertUrlContainsQuery(query: string): Promise<void> {
    const encodedQuery = encodeURIComponent(query).replace(/%20/g, '+');
    await expect(this.page).toHaveURL(new RegExp(`keywords=${encodedQuery}`, 'i'));
    this.logger.info(`Asserted: URL contains search query "${query}"`);
  }

  async assertFirstResultVisible(): Promise<void> {
    const firstCard = this.page.locator(this.RESULT_ITEMS).first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    this.logger.info('Asserted: first result card is visible');
  }

  async assertPeopleFilterActive(): Promise<void> {
    await expect(this.page).toHaveURL(/\/people/, { timeout: 10_000 });
    this.logger.info('Asserted: People filter is active');
  }

  // ─── Data Extraction ──────────────────────────────────────────────────────

  async hasResults(): Promise<boolean> {
    const noResultsVisible = await this.isElementVisible(this.NO_RESULTS_MSG, 2_000);
    if (noResultsVisible) return false;
    const count = await this.getResultCount();
    return count > 0;
  }

  async getResultCount(): Promise<number> {
    return this.page.locator(this.RESULT_ITEMS).count();
  }

  async getTotalResultsText(): Promise<string> {
    try {
      return (await this.page.locator(this.RESULT_COUNT_TEXT).first().textContent())?.trim() || '';
    } catch {
      return '';
    }
  }

  async getCurrentPage(): Promise<number> {
    try {
      const text = await this.page.locator(this.PAGINATION_CURRENT).first().textContent();
      return parseInt(text?.trim() || '1', 10);
    } catch {
      return 1;
    }
  }

  /**
   * Get all visible result cards as ResultCard component instances.
   */
  async getResultCards(): Promise<ResultCard[]> {
    const items = this.page.locator(this.RESULT_ITEMS);
    const count = await items.count();
    const cards: ResultCard[] = [];
    for (let i = 0; i < count; i++) {
      cards.push(new ResultCard(this.page, items.nth(i)));
    }
    return cards;
  }

  /**
   * Serialize all visible results to plain data objects.
   */
  async getResultsData(): Promise<SearchResultsData> {
    const cards = await this.getResultCards();
    const results: SearchResult[] = [];
    for (const card of cards) {
      results.push(await card.toData());
    }
    return {
      totalResults: await this.getTotalResultsText(),
      results,
      hasResults: results.length > 0,
      currentPage: await this.getCurrentPage(),
    };
  }

  async getFirstResult(): Promise<SearchResult | null> {
    const cards = await this.getResultCards();
    if (cards.length === 0) return null;
    return cards[0].toData();
  }

  async getNthResult(index: number): Promise<SearchResult | null> {
    const cards = await this.getResultCards();
    if (index >= cards.length) return null;
    return cards[index].toData();
  }

  // ─── Pagination ───────────────────────────────────────────────────────────

  async hasNextPage(): Promise<boolean> {
    const nextBtn = this.page.locator(this.PAGINATION_NEXT_BTN);
    const isVisible = await nextBtn.isVisible();
    if (!isVisible) return false;
    const isDisabled = await nextBtn.isDisabled();
    return !isDisabled;
  }

  async goToNextPage(): Promise<void> {
    this.logger.info('Navigating to next results page');
    const nextBtn = this.page.locator(this.PAGINATION_NEXT_BTN).first();
    await nextBtn.scrollIntoViewIfNeeded();
    await nextBtn.click();
    await this.waitForResults();
  }

  // ─── Filters ─────────────────────────────────────────────────────────────

  async filterByPeople(): Promise<void> {
    this.logger.info('Applying People filter');
    await this.filterPanel.filterByPeople();
    await this.waitForResults();
  }

  async filterByJobs(): Promise<void> {
    await this.filterPanel.filterByJobs();
    await this.waitForResults();
  }

  async filterByCompanies(): Promise<void> {
    await this.filterPanel.filterByCompanies();
    await this.waitForResults();
  }

  // ─── Spell Check ────────────────────────────────────────────────────────

  async getSpellCheckSuggestion(): Promise<string | null> {
    try {
      const el = this.page.locator(this.SPELL_CHECK_SUGGESTION).first();
      return (await el.textContent())?.trim() || null;
    } catch {
      return null;
    }
  }
}
