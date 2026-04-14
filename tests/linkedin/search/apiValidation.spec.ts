import { test, expect } from '../../../src/fixtures/linkedin.fixture';
import { allure } from 'allure-playwright';
import { RequestInterceptor } from '../../../src/api/linkedin/RequestInterceptor';
import { TestDataManager } from '../../../src/data/TestDataManager';

/**
 * API Validation Tests — hybrid UI + API layer.
 *
 * These tests perform UI actions and then assert that:
 *  - The correct API calls were fired (via RequestInterceptor)
 *  - API responses have correct status codes
 *
 * This bridges the existing Python framework's API validation approach.
 */
test.describe('API Validation — Search Requests', () => {
  test.beforeEach(() => {
    allure.epic('LinkedIn Automation');
    allure.feature('API Layer Validation');
    allure.tag('api'); 
    allure.tag('hybrid'); 
    allure.tag('network');
  });

  test('API-001: Search action should fire a network request to LinkedIn search endpoint', async ({
    page,
    searchPage,
    searchResultsPage,
  }) => {
    allure.story('Search API Validation');
    allure.severity('critical');
    allure.description(
      'Verify that performing a UI search triggers a network request to a ' +
        'LinkedIn search endpoint — confirms the UI wires up correctly to the backend.',
    );

    const interceptor = new RequestInterceptor(page);

    // Watch for any request containing 'search'
    interceptor.watch(/search/);

    const keyword = TestDataManager.getSearchKeyword('SOFTWARE_ENGINEER');

    await searchPage.goToFeed();
    await searchPage.search(keyword);
    await searchResultsPage.waitForResults();

    // Validate at least one search-related network request was fired
    const searchRequests = interceptor.getCaptured(/search/);

    allure.attachment(
      'Captured network requests',
      JSON.stringify(
        searchRequests.map((r) => ({
          url: r.url,
          method: r.method,
          status: r.status,
          timestamp: r.timestamp.toISOString(),
        })),
        null,
        2,
      ),
      'application/json',
    );

    allure.parameter('Captured request count', String(searchRequests.length));

    // LinkedIn always fires at least one network request when navigating to /search/
    expect(searchRequests.length, 'At least one search-related request should be captured').toBeGreaterThan(0);

    // All responses should be successful (2xx or 3xx — no 5xx errors)
    const serverErrors = searchRequests.filter((r) => r.status >= 500);
    expect(serverErrors.length, 'No 5xx server errors should occur during search').toBe(0);
  });

  test('API-002: Search results page load should not produce 4xx API errors', async ({
    page,
    searchPage,
    searchResultsPage,
  }) => {
    allure.story('Search Error Validation');
    allure.severity('normal');
    allure.description(
      'Verify that navigating to the search results page does not cause ' +
        'any 4xx client errors in background API calls.',
    );

    // Track ALL requests for the full page load
    const allRequests: { url: string; status: number }[] = [];
    page.on('response', (res) => {
      if (res.url().includes('linkedin.com')) {
        allRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await searchPage.goToFeed();
    await searchPage.search(TestDataManager.getSearchKeyword('PRODUCT_MANAGER'));
    await searchResultsPage.waitForResults();

    // Filter to only API calls (not static assets)
    const apiCalls = allRequests.filter(
      (r) =>
        r.url.includes('/voyager/api/') ||
        r.url.includes('/search/') ||
        r.url.includes('/graphql'),
    );

    const clientErrors = apiCalls.filter((r) => r.status >= 400 && r.status < 500);

    allure.attachment(
      'API calls on results page',
      JSON.stringify(apiCalls, null, 2),
      'application/json',
    );

    allure.parameter('Total API calls', String(apiCalls.length));
    allure.parameter('Client errors (4xx)', String(clientErrors.length));

    // 401 is expected for unauthenticated Voyager endpoints — filter those out
    const unexpectedErrors = clientErrors.filter((r) => r.status !== 401);
    expect(
      unexpectedErrors.length,
      `Unexpected 4xx API errors: ${JSON.stringify(unexpectedErrors)}`,
    ).toBe(0);
  });
});
