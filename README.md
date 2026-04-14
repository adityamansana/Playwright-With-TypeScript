# Playwright TypeScript Automation Framework

A **robust, layered, production-grade** test automation framework built with Playwright + TypeScript.  
Mirrors and extends the patterns of the existing Python/Selenium/Pytest/Allure framework.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TEST LAYER (specs)                    │
│        tests/linkedin/  ·  tests/smoke/                 │
├─────────────────────────────────────────────────────────┤
│                  FIXTURE / DI LAYER                      │
│     base.fixture  ·  linkedin.fixture  ·  auth.setup    │
├─────────────────────────────────────────────────────────┤
│                PAGE OBJECT LAYER (POM)                   │
│      BasePage  ·  LoginPage  ·  SearchPage              │
│               SearchResultsPage                         │
├─────────────────────────────────────────────────────────┤
│                  COMPONENT LAYER                         │
│   SearchBar · NavigationBar · ResultCard · FilterPanel  │
├──────────────────────────┬──────────────────────────────┤
│      UTILITY LAYER       │        API LAYER             │
│  Logger · WaitUtil       │  BaseApiClient               │
│  ScreenshotUtil          │  LinkedInApiClient           │
│  DataHelper · FileUtil   │                              │
├──────────────────────────┼──────────────────────────────┤
│      CONFIG LAYER        │     TEST DATA LAYER          │
│  ConfigManager           │  TestDataManager             │
│  environments/*.env      │  data/linkedin/searchData    │
├─────────────────────────────────────────────────────────┤
│                  REPORTING LAYER                         │
│  allure-playwright (per-test + suite HTML)              │
│  PdfReporter (per-test PDF + suite PDF)                 │
│  playwright built-in HTML report                        │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Allure CLI | ≥ 2.24 (for HTML reports) |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
npx playwright install chromium firefox
```

### 2. Configure credentials

```bash
cp .env.example .env
# Edit .env and add your LinkedIn email + password
```

### 3. Authenticate (saves session state)

```bash
npx playwright test --project=setup
```

### 4. Run all tests

```bash
npm test
```

### 5. View reports

```bash
# Allure (interactive)
npm run allure:serve

# Playwright HTML
npm run report

# PDF reports
open reports/pdf/
```

---

## Project Structure

```
playwright-ts-framework/
├── src/
│   ├── api/                  # API layer
│   │   ├── base/BaseApiClient.ts
│   │   └── linkedin/LinkedInApiClient.ts
│   ├── components/           # Reusable UI components
│   │   ├── base/BaseComponent.ts
│   │   ├── FilterPanel.ts
│   │   ├── NavigationBar.ts
│   │   ├── ResultCard.ts
│   │   └── SearchBar.ts
│   ├── config/               # Environment config
│   │   ├── ConfigManager.ts
│   │   └── environments/
│   │       ├── dev.env
│   │       └── staging.env
│   ├── data/                 # Test data
│   │   ├── linkedin/searchData.ts
│   │   └── TestDataManager.ts
│   ├── fixtures/             # Playwright fixtures (DI)
│   │   ├── auth.setup.ts
│   │   ├── base.fixture.ts
│   │   └── linkedin.fixture.ts
│   ├── pages/                # Page Objects
│   │   ├── base/BasePage.ts
│   │   └── linkedin/
│   │       ├── LoginPage.ts
│   │       ├── SearchPage.ts
│   │       └── SearchResultsPage.ts
│   ├── reporters/            # Custom reporters
│   │   └── PdfReporter.ts
│   ├── types/                # TypeScript interfaces
│   │   └── index.ts
│   └── utils/                # Utilities
│       ├── DataHelper.ts
│       ├── Logger.ts
│       ├── ScreenshotUtil.ts
│       └── WaitUtil.ts
├── tests/
│   ├── linkedin/
│   │   └── search/
│   │       ├── linkedinSearch.spec.ts   # Core search tests
│   │       └── searchResults.spec.ts    # Results page tests
│   └── smoke/
│       └── smoke.spec.ts                # No-auth smoke tests
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Running Tests

```bash
# All tests (requires auth setup first)
npm test

# Smoke tests only (no auth required)
npx playwright test tests/smoke/ --project=chromium-no-auth

# LinkedIn search tests only
npm run test:linkedin

# Specific browser
npm run test:chrome
npm run test:firefox

# Headed mode (watch the browser)
npm run test:headed

# Debug mode (step through tests)
npm run test:debug

# Interactive UI mode
npm run test:ui
```

### Environment Selection

```bash
# Staging
TEST_ENV=staging npm test

# Custom base URL
BASE_URL=https://staging.linkedin.com npm test
```

---

## Reporting

### Allure Reports

```bash
# Generate and open HTML report
npm run allure:generate && npm run allure:open

# Live serve (auto-refreshes)
npm run allure:serve
```

Allure produces:
- **Per-test report** — steps, attachments, timeline, history
- **Suite report** — full dashboard with graphs and trends
- **Screenshots** attached on failure
- **JSON request/response** attachments for API tests

### PDF Reports (parity with Python framework)

The `PdfReporter` generates:
- **Per-test PDF** — metadata, steps, error details, screenshots
- **Suite summary PDF** — table of all tests with pass/fail status

Output: `reports/pdf/`

### Playwright HTML Report

```bash
npm run report
```

---

## Design Patterns

### Layered Architecture

Each layer has a single responsibility:

| Layer | Responsibility |
|-------|---------------|
| **Test (spec)** | What to test — calls fixtures, makes assertions |
| **Fixture** | Dependency injection of page objects into tests |
| **Page Object** | How to interact with a page — encapsulates selectors + actions |
| **Component** | Reusable sub-page UI atoms (SearchBar, ResultCard, etc.) |
| **Utility** | Cross-cutting concerns — logging, waits, screenshots |
| **Config** | Environment-aware configuration |
| **Data** | Test data management and parameterisation |

### Fixture-Based Dependency Injection

Tests never construct page objects directly.  
The fixture layer does it:

```typescript
// In a test:
test('search test', async ({ searchPage, searchResultsPage }) => {
  await searchPage.search('Software Engineer');
  await searchResultsPage.assertHasResults();
});
```

### Allure Integration

Every test gets automatic allure metadata via the base fixture hook.  
Add granular steps in tests:

```typescript
await allureStep('Navigate to feed', async () => {
  await searchPage.goToFeed();
  await attachScreenshot('Feed loaded');
});
```

---

## Python Framework Bridge

The following capabilities are shared/adapted from the existing Python framework:

| Python Framework | This Framework |
|-----------------|---------------|
| `allure.step()` | `allure.step()` via allure-playwright |
| `pytest.mark.parametrize` | `for (scenario of scenarios)` test loop |
| `conftest.py` fixtures | `src/fixtures/linkedin.fixture.ts` |
| Per-test PDF report | `PdfReporter.ts` |
| Suite PDF report | `PdfReporter.generateSuitePdf()` |
| Utilities (waits, etc.) | `WaitUtil`, `ScreenshotUtil`, `Logger` |
| `.env` config | `ConfigManager` with `environments/*.env` |
| Page Object Model | `BasePage` → specific page classes |

---

## Contributing

1. Add new page objects in `src/pages/`
2. Add reusable components in `src/components/`
3. Add test data in `src/data/`
4. Write specs in `tests/`
5. Import test using the fixture, never raw `page`
6. Run `npm run typecheck && npm run lint` before committing

---

## Troubleshooting

**Auth state missing**
```bash
npx playwright test --project=setup
```

**CAPTCHA / verification required**  
LinkedIn may block automation. Try:
- Use a real account that isn't flagged
- Run `HEADLESS=false npm test` to observe
- Add `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` to `.env`

**Selector failures**  
LinkedIn frequently updates its DOM. Update selectors in:
- `src/components/SearchBar.ts`
- `src/components/ResultCard.ts`
- `src/pages/linkedin/SearchResultsPage.ts`

Use `npm run test:debug` to step through and inspect live selectors.
