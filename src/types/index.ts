import type { Page, BrowserContext, Locator } from '@playwright/test';

// ─── Page Options ───────────────────────────────────────────────────────────

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
}

export interface ClickOptions {
  force?: boolean;
  timeout?: number;
  position?: { x: number; y: number };
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  retries?: number;
}

export interface FillOptions {
  timeout?: number;
  clearFirst?: boolean;
  delay?: number;
}

export interface WaitOptions {
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

// ─── Test Config ─────────────────────────────────────────────────────────────

export interface TestConfig {
  baseUrl: string;
  credentials: {
    email: string;
    password: string;
  };
  timeouts: {
    default: number;
    navigation: number;
    action: number;
  };
  retries: number;
  headless: boolean;
  logLevel: LogLevel;
  authStateFile: string;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

// ─── Fixture Types ────────────────────────────────────────────────────────────

export interface BaseFixtures {
  page: Page;
  context: BrowserContext;
}

export interface LinkedInFixtures extends BaseFixtures {
  loginPage: import('../pages/linkedin/LoginPage').LoginPage;
  searchPage: import('../pages/linkedin/SearchPage').SearchPage;
  searchResultsPage: import('../pages/linkedin/SearchResultsPage').SearchResultsPage;
}

// ─── Page Object Base ─────────────────────────────────────────────────────────

export interface IBasePage {
  page: Page;
  navigate(url?: string, options?: NavigateOptions): Promise<void>;
  waitForPageLoad(): Promise<void>;
  getTitle(): Promise<string>;
  getUrl(): string;
  takeScreenshot(name: string): Promise<string>;
  waitForElement(selector: string, options?: WaitOptions): Promise<Locator>;
  isElementVisible(selector: string, timeout?: number): Promise<boolean>;
  scrollToElement(selector: string): Promise<void>;
}

// ─── Component Interface ──────────────────────────────────────────────────────

export interface IBaseComponent {
  isVisible(): Promise<boolean>;
  waitForVisible(timeout?: number): Promise<void>;
  waitForHidden(timeout?: number): Promise<void>;
}

// ─── Search Types ─────────────────────────────────────────────────────────────

export interface SearchQuery {
  keyword: string;
  filters?: SearchFilters;
}

export interface SearchFilters {
  connectionDegree?: '1st' | '2nd' | '3rd';
  location?: string;
  company?: string;
  industry?: string;
  jobTitle?: string;
}

export interface SearchResult {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  connectionDegree?: string;
  profileUrl?: string;
}

export interface SearchResultsData {
  totalResults?: string;
  results: SearchResult[];
  hasResults: boolean;
  currentPage: number;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = unknown> {
  status: number;
  statusText: string;
  data: T;
  headers: Record<string, string>;
  duration: number;
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface TestReportData {
  testName: string;
  suiteName: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  startTime: Date;
  endTime: Date;
  error?: string;
  screenshots: string[];
  steps: ReportStep[];
  environment: string;
  browser: string;
  retry: number;
}

export interface ReportStep {
  name: string;
  status: 'passed' | 'failed';
  duration: number;
  error?: string;
}

// ─── Logger Interface ─────────────────────────────────────────────────────────

export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
