# Playwright Test Suite - Page Object Model (POM)

This repository demonstrates a professional Playwright test suite refactored to use the Page Object Model pattern for better maintainability, reusability, and readability.

## Quick Start

Run all tests:
```powershell
npx playwright test
```

Run tests from VS Code Test Explorer:
- Click the beaker icon in the sidebar
- Click the play icon next to any test or test file
- HTML report opens automatically for small test runs (≤8 tests)

## Test Suites

This project includes three test suites:
- **Login Tests** (`tests/login.spec.ts`): 5 UI tests validating login functionality with valid/invalid credentials using Page Object Model
- **API Tests** (`tests/api.spec.ts`): 3 REST API tests for the ReqRes API (GET, POST, DELETE) with visual result cards
- **Visual Tests** (`tests/visual.spec.ts`): Visual testing examples

### How `visual.spec.ts` Works

The `visual.spec.ts` test performs visual testing by comparing baseline (`src/visual-baselines/base.png`) and actual (`src/visual-actual/actual.png`) screenshots. It resizes images if dimensions differ, uses **pixelmatch** (a fast pixel-level image comparison library) to detect pixel differences, groups them into regions, and generates a side-by-side annotated image with numbered boxes. The report includes detailed differences and UX impact insights (e.g., readability, navigation). Configurable environment variables allow thresholds (pixel/percent), functional/UX gating, report-only mode, or baseline updates for flexible pass/fail behavior.

## Project Architecture

### Page Object Model (POM)

The test suite uses a layered POM architecture for maintainability and reusability:

**Base Layer**
- `pages/BasePage.ts`: Base class storing the Playwright `Page` object and shared methods like `goto()`

**Page Objects**
- `pages/LoginPage.ts`: Encapsulates login page interactions
  - Methods: `goto()`, `login()`, `fillUsername()`, `fillPassword()`, `clickLogin()`
  - Locators: `flashLocator()` for assertion checks
- `pages/index.ts`: Centralized exports for easy importing

**Test Layer**
- `tests/login.spec.ts`: Login validation tests using `LoginPage`
- `tests/api.spec.ts`: API tests with visual result cards
- `tests/visual.spec.ts`: Visual regression tests

**Supporting Infrastructure**
- `gadgets/fixtures.ts`: Shared test fixtures with screenshot capture and browser context cleanup
- `gadgets/assertHelpers.ts`: Visual assertion helpers that highlight elements in screenshots
- `reporters/human-progress.js`: Emoji-based progress reporter
- `reporters/open-report-if-single.js`: Auto-opens HTML report for small test runs (≤8 tests)

**Key Dependencies**
- `@playwright/test`: Core testing framework
- `pixelmatch`: Fast pixel-level image comparison for visual testing
- `pngjs`: PNG image processing and manipulation
- `path` and `fs` (Node.js built-ins): File system operations

## How to Use the Page Object Model

### Basic Pattern

1. Import the Page Object from `pages/index.ts`
2. Initialize it in `beforeEach` with the Playwright `page` fixture
3. Call page object methods in your tests

Example:
```ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages';

test.describe('Login tests', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('Example login', async ({ page }) => {
    await loginPage.login('tomsmith', 'SuperSecretPassword!');
    await expect(loginPage.flashLocator()).toContainText('You logged into a secure area!');
    await expect(page).toHaveURL('https://the-internet.herokuapp.com/secure');
  });
});
```

### Creating New Page Objects

1. Create a new file in `pages/`, e.g., `pages/DashboardPage.ts`
2. Extend `BasePage`:
```ts
import BasePage from './BasePage';
import { Page, Locator } from '@playwright/test';

export default class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }
  
  // Add locators
  get headerLocator(): Locator {
    return this.page.locator('h1');
  }
  
  // Add actions
  async navigateToSection(section: string) {
    await this.page.click(`nav >> text=${section}`);
  }
}
```
3. Export in `pages/index.ts`:
```ts
export { default as DashboardPage } from './DashboardPage';
```
4. Use in tests:
```ts
import { DashboardPage } from '../pages';
const dashboardPage = new DashboardPage(page);
```

## Running Tests

### Command Line

**Run all tests:**
```powershell
npx playwright test
```

**Run specific test file:**
```powershell
npx playwright test tests/login.spec.ts
```

**Run specific browser:**
```powershell
npx playwright test --project=chromium
# or: firefox, webkit
```

**Run with HTML report auto-open:**
```powershell
$env:OPEN_HTML_REPORT="1"; npx playwright test
```

**View report after tests complete:**
```powershell
npx playwright show-report
```

### VS Code Test Explorer

1. Click the beaker icon in the sidebar
2. Click the play icon next to any test, test file, or "Run All Tests"
3. HTML report opens automatically for runs with ≤8 tests
4. View results inline or click test names to see details

### NPM Scripts

**Quick open HTML report:**
```powershell
npm run open:report
```

**View latest screenshot:**
```powershell
npm run open:latest-screenshot
```

**Run with auto-report on failure:**
```powershell
npm run test:report-on-failure
```

**Run with custom port:**
```powershell
npm run test:report -- --port 9324
```

## Key Features

### Visual Assertion Helpers
Assertions are highlighted in screenshots for easy debugging:
- **Passing assertions** show a yellow "assert" badge
- **Failing assertions** show a red "Assert Failed" badge
- Exact element causing failure is visually marked

Example usage:
```ts
import { expectLocatorToContainText } from '../gadgets/assertHelpers';
await expectLocatorToContainText(loginPage.flashLocator(), 'You logged into a secure area!');
```

### Screenshot Management
- **Auto-capture**: Screenshots taken on test failure (`screenshot: 'only-on-failure'`)
- **Attached to reports**: All screenshots visible in HTML report
- **Organized by test file**: All test artifacts (screenshots, traces, videos) saved in `test-results/login.spec.ts/`, `test-results/api.spec.ts/`, `test-results/visual.spec.ts/` subfolders
- **Browser context cleanup**: Contexts properly closed after each test
- **No orphaned processes**: Chromium workers cleaned up automatically

### Human-Friendly Terminal Progress
Custom reporter `reporters/human-progress.js` provides:
- **Emoji status**: start, running, passed, failed
- **Live progress**: `Progress: 3/20 (15.0%) • Passed: 3 • Failed: 0`
- **Color-coded output**: Quick visual status recognition
- **Per-project summary**: Aggregated results by browser

Disable temporarily:
```powershell
$env:PLAYWRIGHT_NO_HUMAN="1"; npx playwright test
```

### API Test Enhancements
- **Input logging**: All requests logged (endpoint, method, headers, payload)
- **Visual result cards**: Color-coded PASSED/FAILED cards with test details
- **Headless rendering**: Result cards generated without visible browser windows
- **Auto-attached**: Cards appear in HTML report screenshots section

### Artifact Cleanup
Remove old test artifacts (screenshots, traces, videos):

**Cross-platform (npm):**
```powershell
npm run cleanup:artifacts
# Custom retention: npm run cleanup:artifacts -- --days 14
```

**Windows PowerShell:**
```powershell
.\scripts\cleanup-artifacts.ps1 -Days 14 -Path 'test-results'
```

Default retention: 7 days

## Troubleshooting

### Report Server Issues

**"Timeout waiting for report port"**
- Ensure HTML report exists: `npx playwright show-report`
- Try different port: `npx playwright show-report --port 9324`
- Increase timeout in `playwright.config.ts`: `openTimeoutSeconds: 60`

**Report doesn't open from VS Code UI**
- Check threshold: Auto-open only works for ≤8 tests
- Force open: `$env:OPEN_HTML_REPORT="1"`
- Verify reporter in `playwright.config.ts`: `['./reporters/open-report-if-single.js']`

**Lock file blocking reports**
- Module-level cleanup handles this automatically
- Manual cleanup: Remove `.pw-html-report-opened` if stale

### Extension Issues

**VS Code extension not using custom reporters**
- Extension partially ignores `playwright.config.ts` reporters
- Custom reporters still work but console output may not appear
- Reports open via threshold mechanism (≤8 tests)

### Test Execution

**Chromium workers not closing**
- Test fixtures include `page.context().close()` in afterEach
- Verify no infinite loops or hanging operations in tests

**Screenshots missing**
- Check `screenshot: 'only-on-failure'` in `playwright.config.ts`
- View test-results folder: all artifacts saved in subfolders by test file (login.spec.ts/, api.spec.ts/, visual.spec.ts/) per failing test

## Configuration Notes

### Reporter Threshold
- Auto-open triggers for runs with ≤8 tests
- Override with environment variable:
  - Force: `$env:OPEN_HTML_REPORT="1"`
  - Disable: `$env:OPEN_HTML_REPORT="0"`
- Disabled in CI (when `CI` env var is set)

### Custom Reporters
- `reporters/human-progress.js`: Terminal progress with emojis
- `reporters/open-report-if-single.js`: Threshold-based auto-open
- Both configured in `playwright.config.ts` reporter array

## Development Notes

**POM Refactor Benefits:**
- Reduced selector duplication
- Centralized page logic
- Easier maintenance and updates
- Better test readability

**Test Development Process:**
- Tests initially captured with Playwright codegen
- Refactored into POM structure
- Enhanced with visual assertion helpers
- Integrated with custom reporters

---

## Author

**Dariel Aguilar** - QA Engineer
