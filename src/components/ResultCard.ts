import type { Page, Locator } from '@playwright/test';
import { BaseComponent } from './base/BaseComponent';
import type { SearchResult } from '../types';

/**
 * ResultCard — wraps a single search result card in LinkedIn's SERP.
 * Instantiated per-result by SearchResultsPage.
 */
export class ResultCard extends BaseComponent {
  private readonly RESULT_NAME = '.entity-result__title-text a span[aria-hidden="true"], .entity-result__title-line a';
  private readonly RESULT_TITLE = '.entity-result__primary-subtitle';
  private readonly RESULT_COMPANY = '.entity-result__secondary-subtitle';
  private readonly RESULT_LOCATION = '.entity-result__tertiary-subtitle';
  private readonly CONNECT_BTN = 'button[aria-label*="Connect"], button[data-control-name="connect"]';
  private readonly MESSAGE_BTN = 'button[aria-label*="Message"], button[data-control-name="message"]';
  private readonly PROFILE_LINK = '.entity-result__title-text a';
  private readonly CONNECTION_DEGREE = '.entity-result__badge-text, .dist-value';

  constructor(page: Page, private readonly cardLocator: Locator) {
    // We override the root with the specific card locator
    super(page, '.entity-result__item');
    // Override root with the specific locator passed in
    (this as unknown as { root: Locator }).root = cardLocator;
  }

  async getName(): Promise<string> {
    try {
      const nameEl = this.cardLocator.locator(this.RESULT_NAME).first();
      return (await nameEl.textContent())?.trim() || '';
    } catch {
      return '';
    }
  }

  async getTitle(): Promise<string> {
    try {
      return (await this.cardLocator.locator(this.RESULT_TITLE).first().textContent())?.trim() || '';
    } catch {
      return '';
    }
  }

  async getCompany(): Promise<string> {
    try {
      return (await this.cardLocator.locator(this.RESULT_COMPANY).first().textContent())?.trim() || '';
    } catch {
      return '';
    }
  }

  async getLocation(): Promise<string> {
    try {
      return (await this.cardLocator.locator(this.RESULT_LOCATION).first().textContent())?.trim() || '';
    } catch {
      return '';
    }
  }

  async getConnectionDegree(): Promise<string> {
    try {
      return (await this.cardLocator.locator(this.CONNECTION_DEGREE).first().textContent())?.trim() || '';
    } catch {
      return '';
    }
  }

  async getProfileUrl(): Promise<string | null> {
    try {
      return this.cardLocator.locator(this.PROFILE_LINK).first().getAttribute('href');
    } catch {
      return null;
    }
  }

  async clickProfile(): Promise<void> {
    this.logger.info('Clicking profile link');
    await this.cardLocator.locator(this.PROFILE_LINK).first().click();
  }

  async clickConnect(): Promise<void> {
    this.logger.info('Clicking Connect button');
    await this.cardLocator.locator(this.CONNECT_BTN).first().click();
  }

  async hasConnectButton(): Promise<boolean> {
    return this.cardLocator.locator(this.CONNECT_BTN).isVisible();
  }

  async hasMessageButton(): Promise<boolean> {
    return this.cardLocator.locator(this.MESSAGE_BTN).isVisible();
  }

  /**
   * Serialize all card data into a plain object.
   */
  async toData(): Promise<SearchResult> {
    const [name, title, company, location, connectionDegree, profileUrl] = await Promise.all([
      this.getName(),
      this.getTitle(),
      this.getCompany(),
      this.getLocation(),
      this.getConnectionDegree(),
      this.getProfileUrl(),
    ]);
    return { name, title, company, location, connectionDegree, profileUrl: profileUrl || undefined };
  }
}
