import { test, expect } from '../../../src/fixtures/linkedin.fixture';
import { allure } from 'allure-playwright';
import { TestDataManager } from '../../../src/data/TestDataManager';

/**
 * LinkedIn Search — functional test suite.
 *
 * Covers:
 *  1. Initiating a search from the feed
 *  2. Verifying the results page loads correctly
 *  3. Applying the People filter
 *  4. Validating result card data
 *  5. Pagination check
 *
 * Prerequisites:
 *  - Auth state must be present (run auth.setup.ts first)
 *  - Valid LinkedIn credentials in env vars
 */
test.describe('LinkedIn Search', () => {
  test.beforeEach(async ({ page }) => {
    allure.epic('LinkedIn Automation');
    allure.feature('Global Search');
    allure.severity('critical');
  });

  // ─── TC-001: Search from Feed ────────────────────────────────────────────

  test('TC-001: Should perform a search and land on results page', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
    allureStep,
  }) => {
    allure.story('Search Initiation');
    allure.description(
      'Verify that typing a keyword in the global search bar and pressing Enter ' +
        'navigates the user to the search results page.',
    );
    allure.tag('search');
    allure.tag('smoke');
    allure.tag('navigation');

    const keyword = TestDataManager.getSearchKeyword('SOFTWARE_ENGINEER');

    await allureStep('Navigate to LinkedIn feed', async () => {
      await searchPage.goToFeed();
      await attachScreenshot('Feed page loaded');
    });

    await allureStep(`Search for "${keyword}"`, async () => {
      await searchPage.search(keyword);
      await attachScreenshot('After search submitted');
    });

    await allureStep('Verify search results page is displayed', async () => {
      await searchResultsPage.waitForResults();
      await searchResultsPage.assertOnResultsPage();
      await attachScreenshot('Search results page');
    });

    await allureStep('Verify results URL contains the search query', async () => {
      await searchResultsPage.assertUrlContainsQuery(keyword);
    });
  });

  // ─── TC-002: Results Page Has Results ────────────────────────────────────

  test('TC-002: Should display results for a known search term', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
    allureStep,
  }) => {
    allure.story('Search Results');
    allure.description(
      'Verify that a search for a common job title returns at least one result.',
    );
    allure.tag('search');
    allure.tag('results');
    allure.tag('regression');

    const keyword = TestDataManager.getSearchKeyword('SOFTWARE_ENGINEER');

    await allureStep('Navigate and search', async () => {
      await searchPage.goToFeed();
      await searchPage.search(keyword);
      await searchResultsPage.waitForResults();
    });

    await allureStep('Assert results are present', async () => {
      await searchResultsPage.assertHasResults();
      await searchResultsPage.assertResultCountAtLeast(1);
      await attachScreenshot('Results present');
    });

    await allureStep('Assert first result card is visible', async () => {
      await searchResultsPage.assertFirstResultVisible();
    });
  });

  // ─── TC-003: Filter by People ────────────────────────────────────────────

  test('TC-003: Should filter search results by People', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
    allureStep,
  }) => {
    allure.story('Search Filters');
    allure.description(
      'Verify that clicking the People filter refines results to show only people.',
    );
    allure.tag('search');
    allure.tag('filters');
    allure.tag('people');

    const keyword = TestDataManager.getSearchKeyword('DATA_SCIENTIST');

    await allureStep('Navigate and search', async () => {
      await searchPage.goToFeed();
      await searchPage.search(keyword);
      await searchResultsPage.waitForResults();
    });

    await allureStep('Apply People filter', async () => {
      await searchResultsPage.filterByPeople();
      await attachScreenshot('After People filter applied');
    });

    await allureStep('Verify URL reflects People filter', async () => {
      await searchResultsPage.assertPeopleFilterActive();
    });

    await allureStep('Verify results still present after filtering', async () => {
      await searchResultsPage.assertHasResults();
      await attachScreenshot('People filter results');
    });
  });

  // ─── TC-004: Result Card Data Extraction ────────────────────────────────

  test('TC-004: Should extract valid data from result cards', async ({
    searchPage,
    searchResultsPage,
    allureStep,
  }) => {
    allure.story('Result Card Validation');
    allure.description(
      'Verify that each visible result card exposes at least a name field, ' +
        'confirming the POM component layer correctly reads LinkedIn card DOM.',
    );
    allure.tag('search');
    allure.tag('results');
    allure.tag('data-extraction');

    const keyword = TestDataManager.getSearchKeyword('PRODUCT_MANAGER');

    await allureStep('Navigate, search and filter to people', async () => {
      await searchPage.goToFeed();
      await searchPage.search(keyword);
      await searchResultsPage.waitForResults();
      await searchResultsPage.filterByPeople();
    });

    await allureStep('Extract result card data', async () => {
      const resultsData = await searchResultsPage.getResultsData();

      allure.attachment(
        'Search Results Data',
        JSON.stringify(resultsData, null, 2),
        'application/json',
      );

      // Every result must have at least a name
      for (const result of resultsData.results) {
        expect(result.name, 'Result card should have a non-empty name').toBeTruthy();
      }

      allure.parameter('Result count', String(resultsData.results.length));
      allure.parameter('Total results text', resultsData.totalResults || 'N/A');
    });
  });

  // ─── TC-005: Multiple Search Keywords ───────────────────────────────────

  test.describe('Parameterised search scenarios', () => {
    const scenarios = TestDataManager.getSearchScenarios();

    for (const scenario of scenarios) {
      test(`TC-PARAM: ${scenario.description}`, async ({
        searchPage,
        searchResultsPage,
        attachScreenshot,
      }) => {
        allure.story('Parameterised Search');
        allure.description(scenario.description);
        allure.parameter('Keyword', scenario.query);
        allure.tag('search');
        allure.tag('parameterised');

        await searchPage.goToFeed();
        await searchPage.search(scenario.query);
        await searchResultsPage.waitForResults();
        await attachScreenshot(`Results for: ${scenario.query}`);

        if (scenario.filterToPeople) {
          await searchResultsPage.filterByPeople();
          await searchResultsPage.assertPeopleFilterActive();
        }

        await searchResultsPage.assertResultCountAtLeast(scenario.assertMinResults);
      });
    }
  });
});
