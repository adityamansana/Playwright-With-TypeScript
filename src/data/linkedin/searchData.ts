import type { SearchQuery } from '../../types';

/**
 * LinkedIn search test data.
 * Centralised here so all spec files share the same data source.
 */

// ─── Search Keywords ──────────────────────────────────────────────────────────

export const SEARCH_KEYWORDS = {
  SOFTWARE_ENGINEER: 'Software Engineer',
  DATA_SCIENTIST: 'Data Scientist',
  PRODUCT_MANAGER: 'Product Manager',
  FRONTEND_DEVELOPER: 'Frontend Developer',
  MACHINE_LEARNING: 'Machine Learning',
  DEVOPS_ENGINEER: 'DevOps Engineer',
  CYBER_SECURITY: 'Cybersecurity Analyst',
  EMPTY: '',
  SPECIAL_CHARS: 'C++ Developer',
  LONG_QUERY: 'Senior Software Engineer at a Fortune 500 Technology Company',
  TYPO_QUERY: 'Softwaer Enginer', // tests spell-check handling
  SINGLE_CHAR: 'A',
} as const;

// ─── Search Queries (with filters) ───────────────────────────────────────────

export const SEARCH_QUERIES: Record<string, SearchQuery> = {
  peopleSearch: {
    keyword: SEARCH_KEYWORDS.SOFTWARE_ENGINEER,
    filters: {
      connectionDegree: '2nd',
    },
  },
  dataScientistSearch: {
    keyword: SEARCH_KEYWORDS.DATA_SCIENTIST,
    filters: {
      industry: 'Technology',
    },
  },
  productManagerSearch: {
    keyword: SEARCH_KEYWORDS.PRODUCT_MANAGER,
  },
};

// ─── Expected URL Patterns ────────────────────────────────────────────────────

export const EXPECTED_URLS = {
  feedPage: /\/feed/,
  searchResults: /\/search\/results/,
  peopleResults: /\/search\/results\/people/,
  jobResults: /\/search\/results\/jobs/,
  companyResults: /\/search\/results\/companies/,
  loginPage: /\/login/,
};

// ─── Expected Page Titles ─────────────────────────────────────────────────────

export const EXPECTED_TITLES = {
  feed: /LinkedIn/,
  searchResults: /LinkedIn/,
  login: /LinkedIn/,
};

// ─── Assertions ───────────────────────────────────────────────────────────────

export const ASSERTIONS = {
  minResultsCount: 2,
  maxWaitForResultsMs: 30_000,
} as const;

// ─── Test Scenarios ───────────────────────────────────────────────────────────

export interface SearchTestScenario {
  description: string;
  query: string;
  filterToPeople: boolean;
  assertMinResults: number;
  assertKeywordInResults: boolean;
}

export const SEARCH_SCENARIOS: SearchTestScenario[] = [
  {
    description: 'Search for Software Engineers — should return people results',
    query: SEARCH_KEYWORDS.SOFTWARE_ENGINEER,
    filterToPeople: true,
    assertMinResults: 1,
    assertKeywordInResults: false, // LinkedIn results can match by profile, not just title
  },
  {
    description: 'Search for Data Scientists — should return results',
    query: SEARCH_KEYWORDS.DATA_SCIENTIST,
    filterToPeople: false,
    assertMinResults: 1,
    assertKeywordInResults: false,
  },
  {
    description: 'Search for Product Managers — should return results',
    query: SEARCH_KEYWORDS.PRODUCT_MANAGER,
    filterToPeople: true,
    assertMinResults: 1,
    assertKeywordInResults: false,
  },
];
