// ⚠️  HUMAN REVIEW REQUIRED
// Scenario: TC-AI-001
// Reason: npx not found
// Generated: 2026-04-23T23:48:00.487296
// Review and fix before adding to test suite
// ─────────────────────────────────────────────

import { test, expect } from '../../../src/fixtures/linkedin.fixture';
import { TestDataManager } from '../../../src/data/TestDataManager';

/**
 * TC-AI-001: LinkedIn People Search - Search returns results for a valid keyword
 *
 * User Story: As a recruiter I want to search for candidates by job title so I can find relevant profiles
 *
 * Preconditions:
 *  - User is logged in (auth state must be present)
 *  - User is on LinkedIn feed
 *
 * Test Steps:
 *  1. Navigate to LinkedIn feed
 *  2. Search for "Software Engineer"
 *  3. Verify results page loaded
 *  4. Verify results are present
 *
 * Expected Result:
 *  Results page shows people results for Software Engineer keyword
 */
test.describe('LinkedIn People Search', () => {
  test.beforeEach(async ({ page }) => {
    // Configure Allure metadata for all tests in this suite
    test.slow(); // Mark as potentially slow due to network delays
  });

  test('TC-AI-001: Search returns results for a valid keyword', async ({
    searchPage,
    searchResultsPage,
    attachScreenshot,
    allureStep,
  }) => {
    // ─── Allure Annotations ────────────────────────────────────────────────
    test.setTimeout(90_000); // Extended timeout for LinkedIn network delays

    // ─── Test Data ─────────────────────────────────────────────────────────
    // Never hardcode test data - always use TestDataManager
    const searchKeyword = TestDataManager.getSearchKeyword('SOFTWARE_ENGINEER');

    // ─── Test Execution ────────────────────────────────────────────────────

    await allureStep('Step 1: Navigate to LinkedIn feed', async () => {
      await searchPage.goToFeed();
      await searchPage.assertOnFeed();
      await attachScreenshot('LinkedIn feed page loaded');
    });

    await allureStep(`Step 2: Search for "${searchKeyword}"`, async () => {
      await searchPage.search(searchKeyword);
      await attachScreenshot('Search submitted');
    });

    await allureStep('Step 3: Verify results page loaded', async () => {
      await searchResultsPage.waitForResults();
      await searchResultsPage.assertOnResultsPage();
      await attachScreenshot('Search results page loaded');
    });

    await allureStep('Step 4: Verify results are present', async () => {
      await searchResultsPage.assertHasResults();
      await searchResultsPage.assertResultCountAtLeast(1);
      await searchResultsPage.assertFirstResultVisible();
      await attachScreenshot('Results verified as present');
    });

    // ─── Additional Validation ─────────────────────────────────────────────

    await allureStep('Verify URL contains search query', async () => {
      await searchResultsPage.assertUrlContainsQuery(searchKeyword);
    });

    await allureStep('Extract and validate result data', async () => {
      const resultsData = await searchResultsPage.getResultsData();
      
      // Attach results data to Allure report
      const buffer = Buffer.from(JSON.stringify(resultsData, null, 2));
      await attachScreenshot('Final results state');
      
      // Validate results structure
      expect(resultsData.hasResults, 'Results should be present').toBe(true);
      expect(resultsData.results.length, 'Should have at least one result').toBeGreaterThan(0);
      
      // Validate first result has required data
      const firstResult = resultsData.results[0];
      expect(firstResult.name, 'First result should have a name').toBeTruthy();
    });
  });
});