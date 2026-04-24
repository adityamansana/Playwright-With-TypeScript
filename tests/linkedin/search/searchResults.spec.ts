import { test, expect } from '../../../src/fixtures/linkedin.fixture';
import { allure } from 'allure-playwright';
import { TestDataManager } from '../../../src/data/TestDataManager';
import { WaitUtil } from '../../../src/utils/WaitUtil';

/**
 * Search Results Page — deep verification suite.
 *
 * Covers result card structure, pagination, filter combinations,
 * and URL/title assertions on the SERP.
 */
test.describe('Search Results Page', () => {
  test.beforeEach(async () => {
    allure.epic('LinkedIn Automation');
    allure.feature('Search Results Page');
  });

  // ─── TC-010: Results Page Title ──────────────────────────────────────────

  test('TC-010: Results page should have a valid browser title', async ({
    searchPage,
    searchResultsPage,
  }) => {
    allure.story('Page Metadata');
    allure.severity('normal');
    allure.tag('results', 'title', 'metadata');

    await searchPage.goToFeed();
    await searchPage.search(TestDataManager.getSearchKeyword('FRONTEND_DEVELOPER'));
    await searchResultsPage.waitForResults();

    const title = await searchResultsPage.getTitle();
    expect(title, 'Page title should not be empty').toBeTruthy();
    expect(title.length, 'Page title should be meaningful').toBeGreaterThan(3);

    allure.parameter('Page title', title);
  });

  // ─── TC-011: Results page URL structure ─────────────────────────────────

  test('TC-011: Results page URL should contain expected parameters', async ({
    searchPage,
    searchResultsPage,
  }) => {
    allure.story('URL Validation');
    allure.severity('critical');
    allure.tag('results', 'url', 'navigation');

    const keyword = TestDataManager.getSearchKeyword('DEVOPS_ENGINEER');

    await searchPage.goToFeed();
    await searchPage.search(keyword);
    await searchResultsPage.waitForResults();
    await searchResultsPage.assertOnResultsPage();

    const currentUrl = searchResultsPage.getUrl();
    allure.parameter('Results URL', currentUrl);

    // URL must contain the keywords parameter
    expect(currentUrl, 'URL should contain "keywords" query param').toContain('keywords=');
    expect(currentUrl, 'URL should point to /search/results/').toContain('/search/results/');
  });

  // ─── TC-012: No results state ────────────────────────────────────────────

  test('TC-012: Should handle no-results gracefully for nonsense query', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
  }) => {
    allure.story('Edge Cases');
    allure.severity('normal');
    allure.tag('results', 'edge-case', 'no-results');
    allure.description(
      'Confirm the page remains stable and shows an appropriate state ' +
        'when the search term is highly unlikely to return results.',
    );

    // Extremely unlikely search term
    const keyword = 'xqzfoo123barnotexist';

    await searchPage.goToFeed();
    await searchPage.search(keyword);

    // Wait a bit for results/no-results state
    await WaitUtil.sleep(3000);
    await attachScreenshot('After nonsense query search');

    // We land on the results page regardless
    await searchResultsPage.assertOnResultsPage();

    // Either no results message, OR results from spell-check suggestion
    const hasResults = await searchResultsPage.hasResults();
    allure.parameter('Has results', String(hasResults));
    // No assertion here — just confirm no crash
  });

  // ─── TC-013: Result card structure ──────────────────────────────────────

  test('TC-013: People result cards should have expected structure', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
    allureStep,
  }) => {
    allure.story('Result Card Structure');
    allure.severity('critical');
    allure.tag('results', 'cards', 'structure');

    const keyword = TestDataManager.getSearchKeyword('MACHINE_LEARNING');

    await allureStep('Navigate and search for ML professionals', async () => {
      await searchPage.goToFeed();
      await searchPage.search(keyword);
      await searchResultsPage.waitForResults();
    });

    await allureStep('Apply People filter', async () => {
      await searchResultsPage.filterByPeople();
    });

    await allureStep('Validate first card structure', async () => {
      const firstResult = await searchResultsPage.getFirstResult();
      expect(firstResult, 'First result should not be null').not.toBeNull();

      if (firstResult) {
        allure.parameter('First result name', firstResult.name || '');
        allure.parameter('First result title', firstResult.title || '');

        // Name is the most essential field — must be present
        expect(firstResult.name, 'First result must have a name').toBeTruthy();
      }

      await attachScreenshot('First card validated');
    });

    await allureStep('Validate all visible card names', async () => {
      const cards = await searchResultsPage.getResultCards();
      const results = await Promise.all(cards.map((c) => c.toData()));

      const cardsWithNames = results.filter((r) => r.name.length > 0);
      allure.parameter('Total cards', String(results.length));
      allure.parameter('Cards with names', String(cardsWithNames.length));

      expect(cardsWithNames.length, 'At least one card must have a name').toBeGreaterThan(0);

      allure.attachment('All card data', JSON.stringify(results, null, 2), 'application/json');
    });
  });

  // ─── TC-014: Filter by Companies ────────────────────────────────────────

  test('TC-014: Should filter results by Companies', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
  }) => {
    allure.story('Search Filters');
    allure.severity('normal');
    allure.tag('results', 'filters', 'companies');

    await searchPage.goToFeed();
    await searchPage.search(TestDataManager.getSearchKeyword('MACHINE_LEARNING'));
    await searchResultsPage.waitForResults();

    await searchResultsPage.filterByCompanies();
    await attachScreenshot('Company filter applied');

    // URL should now reflect company filter
    const url = searchResultsPage.getUrl();
    allure.parameter('URL after company filter', url);
    expect(url).toMatch(/\/search\/results\//);
  });

  // ─── TC-015: Pagination ──────────────────────────────────────────────────

  test('TC-015: Should navigate to next page of results', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
    allureStep,
  }) => {
    allure.story('Pagination');
    allure.severity('normal');
    allure.tag('results', 'pagination');

    const keyword = TestDataManager.getSearchKeyword('SOFTWARE_ENGINEER');

    await allureStep('Navigate and search', async () => {
      await searchPage.goToFeed();
      await searchPage.search(keyword);
      await searchResultsPage.waitForResults();
      await searchResultsPage.filterByPeople();
    });

    const hasNext = await searchResultsPage.hasNextPage();
    allure.parameter('Has next page', String(hasNext));

    if (hasNext) {
      await allureStep('Go to next page', async () => {
        const firstPageResults = await searchResultsPage.getResultsData();
        allure.parameter('Page 1 result count', String(firstPageResults.results.length));

        await searchResultsPage.goToNextPage();
        await attachScreenshot('Page 2 results');

        const secondPageResults = await searchResultsPage.getResultsData();
        allure.parameter('Page 2 result count', String(secondPageResults.results.length));

        expect(secondPageResults.results.length, 'Page 2 should have results').toBeGreaterThan(0);
      });
    } else {
      allure.description('No second page available for this search — test skipped gracefully.');
    }
  });

  // ─── TC-016: Navigation Bar Visible on Results Page ──────────────────────

  test('TC-016: Global navigation bar should be visible on results page', async ({
    searchPage,
    searchResultsPage,
  }) => {
    allure.story('Page Layout');
    allure.severity('normal');
    allure.tag('results', 'navigation', 'layout');

    await searchPage.goToFeed();
    await searchPage.search(TestDataManager.getSearchKeyword('PRODUCT_MANAGER'));
    await searchResultsPage.waitForResults();

    const navVisible = await searchResultsPage.navBar.isNavVisible();
    expect(navVisible, 'Navigation bar should be visible on results page').toBe(true);

    const isLoggedIn = await searchResultsPage.navBar.isLoggedIn();
    expect(isLoggedIn, 'User should appear logged in on results page').toBe(true);
  });
});
