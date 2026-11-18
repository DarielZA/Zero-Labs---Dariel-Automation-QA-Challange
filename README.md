# Playwright Test Suite - Page Object Model (POM)

A practice Playwright test suite built with the Page Object Model pattern.

## What's included

- **Login tests** (`tests/login.spec.ts`): 5 UI tests for valid and invalid logins, written with page objects
- **API tests** (`tests/api.spec.ts`): 3 REST API tests against the ReqRes API (GET, POST, DELETE), with result cards attached to the HTML report
- **Visual tests** (`tests/visual.spec.ts`): compares a baseline and an actual screenshot with pixelmatch and generates an annotated image with the differences

## Project structure

- `pages/`: the page objects (`BasePage.ts`, `LoginPage.ts`)
- `gadgets/`: shared fixtures and assertion helpers that highlight elements in screenshots
- `reporters/`: a terminal progress reporter, and a reporter that opens the HTML report automatically after small runs

## Run it

Requires Node.js. Install dependencies with `npm install` and browsers with `npx playwright install`.

```bash
# Run all tests
npx playwright test

# Run one file
npx playwright test tests/login.spec.ts

# Run in one browser (chromium, firefox or webkit)
npx playwright test --project=chromium

# Open the HTML report
npx playwright show-report
```

Test artifacts (screenshots, traces, videos) are saved under `test-results/`.

---

## Author

**Dariel Aguilar** - QA Engineer
