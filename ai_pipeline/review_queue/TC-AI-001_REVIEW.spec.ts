// ⚠️  HUMAN REVIEW REQUIRED
// Scenario: TC-AI-001
// Reason: TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
// Generated: 2026-04-24T11:45:36.910632
// Review and fix before adding to test suite
// ─────────────────────────────────────────────

import { test, expect } from '../../../src/fixtures/linkedin.fixture';
import { allure } from 'allure-playwright';
import { TestDataManager } from '../../../src/data/TestDataManager';

test.describe('LinkedIn People Search', () => {
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
    allure.description('Search returns results for a valid keyword');
    allure.tag('search');
    allure.tag('people');
    allure.tag('critical');

    // Test data
    const keyword = TestDataManager.getSearchKeyword('SOFTWARE_ENGINEER');

    // Step 1: Navigate to LinkedIn feed
    await allureStep('Navigate to LinkedIn feed', async () => {
      await searchPage.goToFeed();
      await searchPage.assertOnFeed();
      await attachScreenshot('LinkedIn feed page loaded');
    });

    // Step 2: Search for Software Engineer
    await allureStep(`Search for "${keyword}"`, async () => {
      await searchPage.search(keyword);
      await attachScreenshot('Search submitted');
    });

    // Step 3: Verify results page loaded
    await allureStep('Verify results page loaded', async () => {
      await searchResultsPage.waitForResults();
      await searchResultsPage.assertOnResultsPage();
      await attachScreenshot('Search results page loaded');
    });

    // Step 4: Verify results are present
    await allureStep('Verify results are present', async () => {
      await searchResultsPage.assertHasResults();
      await searchResultsPage.assertResultCountAtLeast(1);
      await searchResultsPage.assertFirstResultVisible();
      await attachScreenshot('Results displayed successfully');
    });

    // Additional verification: URL contains search query
    await allureStep('Verify URL contains search query', async () => {
      await searchResultsPage.assertUrlContainsQuery(keyword);
    });
  });
});