import { SEARCH_KEYWORDS, SEARCH_QUERIES, SEARCH_SCENARIOS } from './linkedin/searchData';
import type { SearchQuery } from '../types';
import type { SearchTestScenario } from './linkedin/searchData';

/**
 * TestDataManager — single entry point for all test data.
 *
 * Abstracts away where data comes from (hardcoded, JSON file, API, faker).
 * Tests import from here, not from individual data files.
 */
export class TestDataManager {
  // ─── LinkedIn Search ─────────────────────────────────────────────────────

  static getSearchKeyword(
    key: keyof typeof SEARCH_KEYWORDS,
  ): string {
    return SEARCH_KEYWORDS[key];
  }

  static getSearchQuery(key: keyof typeof SEARCH_QUERIES): SearchQuery {
    return { ...SEARCH_QUERIES[key] };
  }

  static getSearchScenarios(): SearchTestScenario[] {
    return SEARCH_SCENARIOS.map((s) => ({ ...s }));
  }

  static getRandomSearchKeyword(): string {
    const keys = Object.keys(SEARCH_KEYWORDS).filter(
      (k) => k !== 'EMPTY' && k !== 'TYPO_QUERY' && k !== 'SINGLE_CHAR',
    ) as Array<keyof typeof SEARCH_KEYWORDS>;
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return SEARCH_KEYWORDS[randomKey];
  }

  // ─── Environment-aware data ───────────────────────────────────────────────

  static getBaseUrl(): string {
    return process.env.BASE_URL || 'https://www.linkedin.com';
  }

  static getCredentials(): { email: string; password: string } {
    return {
      email: process.env.LINKEDIN_EMAIL || '',
      password: process.env.LINKEDIN_PASSWORD || '',
    };
  }
}
