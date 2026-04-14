import { test as base, expect } from './base.fixture';
import { LoginPage } from '../pages/linkedin/LoginPage';
import { SearchPage } from '../pages/linkedin/SearchPage';
import { SearchResultsPage } from '../pages/linkedin/SearchResultsPage';
import { allure } from 'allure-playwright';

/**
 * LinkedIn-specific fixtures.
 *
 * Injects fully-constructed page objects into tests,
 * so tests never call `new LoginPage(page)` directly.
 *
 * Usage in a spec file:
 *   import { test, expect } from '@fixtures/linkedin.fixture';
 *
 *   test('should search', async ({ searchPage, searchResultsPage }) => {
 *     ...
 *   });
 */
type LinkedInFixtures = {
  loginPage: LoginPage;
  searchPage: SearchPage;
  searchResultsPage: SearchResultsPage;
};

export const test = base.extend<LinkedInFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  searchPage: async ({ page }, use) => {
    allure.label('feature', 'LinkedIn Search');
    allure.label('layer', 'UI');
    const searchPage = new SearchPage(page);
    await use(searchPage);
  },

  searchResultsPage: async ({ page }, use) => {
    const searchResultsPage = new SearchResultsPage(page);
    await use(searchResultsPage);
  },
});

export { expect };
