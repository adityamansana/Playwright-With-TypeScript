import type { Page } from '@playwright/test';
import { BaseComponent } from './base/BaseComponent';
import { WaitUtil } from '../utils/WaitUtil';

/**
 * FilterPanel — wraps LinkedIn's search filter sidebar / filter chips.
 */
export class FilterPanel extends BaseComponent {
  // Top-level filter buttons (People, Jobs, etc.)
  private readonly FILTER_PEOPLE = 'button[aria-label*="People"], a[href*="search/results/people"]';
  private readonly FILTER_JOBS = 'button[aria-label*="Jobs"], a[href*="search/results/jobs"]';
  private readonly FILTER_COMPANIES = 'button[aria-label*="Companies"], a[href*="search/results/companies"]';
  private readonly FILTER_POSTS = 'button[aria-label*="Posts"], a[href*="search/results/content"]';

  // All filters button
  private readonly ALL_FILTERS_BTN = 'button[aria-label="All filters"], button.search-reusables__all-filters-cta';

  // Connection degree filter
  private readonly CONNECTION_1ST = 'label[for*="connection-1"], button[aria-label*="1st degree"]';
  private readonly CONNECTION_2ND = 'label[for*="connection-2"], button[aria-label*="2nd degree"]';
  private readonly CONNECTION_3RD = 'label[for*="connection-3"], button[aria-label*="3rd degree"]';

  // Apply/Show results button inside filter panel
  private readonly APPLY_FILTERS_BTN = 'button[aria-label*="Apply"], button.artdeco-button--primary';

  constructor(page: Page) {
    super(page, 'div.search-results__filters-bar, div.reusable-search__filters-bar');
  }

  async filterByPeople(): Promise<void> {
    this.logger.info('Filtering by People');
    await this.page.locator(this.FILTER_PEOPLE).first().click();
    await this.page.waitForLoadState('domcontentloaded');
    await WaitUtil.humanDelay(500, 1000);
  }

  async filterByJobs(): Promise<void> {
    this.logger.info('Filtering by Jobs');
    await this.page.locator(this.FILTER_JOBS).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async filterByCompanies(): Promise<void> {
    this.logger.info('Filtering by Companies');
    await this.page.locator(this.FILTER_COMPANIES).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async filterByPosts(): Promise<void> {
    this.logger.info('Filtering by Posts');
    await this.page.locator(this.FILTER_POSTS).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openAllFilters(): Promise<void> {
    this.logger.info('Opening All Filters panel');
    await this.page.locator(this.ALL_FILTERS_BTN).first().click();
    await WaitUtil.sleep(800);
  }

  async filterBy1stDegree(): Promise<void> {
    await this.openAllFilters();
    await this.page.locator(this.CONNECTION_1ST).first().click();
    await this.applyFilters();
  }

  async filterBy2ndDegree(): Promise<void> {
    await this.openAllFilters();
    await this.page.locator(this.CONNECTION_2ND).first().click();
    await this.applyFilters();
  }

  async applyFilters(): Promise<void> {
    this.logger.info('Applying filters');
    await this.page.locator(this.APPLY_FILTERS_BTN).last().click();
    await this.page.waitForLoadState('domcontentloaded');
    await WaitUtil.humanDelay(500, 1000);
  }

  async isPeopleFilterActive(): Promise<boolean> {
    return this.page.url().includes('/people');
  }
}
