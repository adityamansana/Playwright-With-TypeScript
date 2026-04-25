// ⚠️  HUMAN REVIEW REQUIRED
// Scenario: TC-AI-001
// Reason: TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
// Generated: 2026-04-25T12:47:04.524282
// Review and fix before adding to test suite
// ─────────────────────────────────────────────

import { test, expect } from '../../../src/fixtures/linkedin.fixture';
import { allure } from 'allure-playwright';
import { TestDataManager } from '../../../src/data/TestDataManager';

/**
 * TC-AI-001: LinkedIn People Search - Search returns results for a valid keyword
 * 
 * User Story: As a recruiter I want to search for candidates by job title 
 * so I can find relevant profiles
 * 
 * Preconditions:
 *  - User is logged in (auth state present)
 *  - User is on LinkedIn feed
 * 
 * Test Flow:
 *  1. Navigate to LinkedIn feed
 *  2. Search for "Software Engineer"
 *  3. Verify results page is loaded
 *  4. Verify results are present
 */
test.describe('LinkedIn People Search - TC-AI-001', () => {
  test.beforeEach(async () => {
    allure.epic('LinkedIn Automation');
    allure.feature('LinkedIn People Search');
  });

  test('TC-AI-001: Search returns results for a valid keyword', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
    allureStep,
  }) => {
    // Test metadata
    allure.story('As a recruiter I want to search for candidates by job title so I can find relevant profiles');
    allure.severity('critical');
    allure.description('Search returns results for a valid keyword - verifies that searching for Software Engineer returns people results');
    allure.tag('search');
    allure.tag('people');
    allure.tag('critical');
    allure.tag('smoke');

    // Get test data
    const searchKeyword = TestDataManager.getSearchKeyword('SOFTWARE_ENGINEER');
    allure.parameter('Search Keyword', searchKeyword);

    // Step 1: Navigate to LinkedIn feed
    await allureStep('Navigate to LinkedIn feed', async () => {
      await searchPage.goToFeed();
      await searchPage.assertOnFeed();
      await attachScreenshot('LinkedIn feed loaded');
    });

    // Step 2: Search for Software Engineer
    await allureStep(`Search for "${searchKeyword}"`, async () => {
      await searchPage.search(searchKeyword);
      await attachScreenshot('Search submitted');
    });

    // Step 3: Verify results page is loaded
    await allureStep('Verify results page is loaded', async () => {
      await searchResultsPage.waitForResults();
      await searchResultsPage.assertOnResultsPage();
      await searchResultsPage.assertUrlContainsQuery(searchKeyword);
      await attachScreenshot('Search results page loaded');
    });

    // Step 4: Verify results are present
    await allureStep('Verify results are present', async () => {
      await searchResultsPage.assertHasResults();
      await searchResultsPage.assertResultCountAtLeast(1);
      await searchResultsPage.assertFirstResultVisible();
      await attachScreenshot('Results validated');
    });

    // Additional validation: Extract and verify result data
    await allureStep('Extract and validate result data', async () => {
      const resultsData = await searchResultsPage.getResultsData();
      
      allure.attachment(
        'Search Results Data',
        JSON.stringify(resultsData, null, 2),
        'application/json',
      );

      expect(resultsData.hasResults, 'Results should be present').toBe(true);
      expect(resultsData.results.length, 'Should have at least one result').toBeGreaterThan(0);

      allure.parameter('Total Results Count', String(resultsData.results.length));
      allure.parameter('Results Text', resultsData.totalResults || 'N/A');
    });
  });
});