// Import Playwright test helpers and assertion helpers
// Import test from our fixtures so the afterEach hook and fixtures are used
import { test, expect } from '../gadgets/fixtures';
import { expectLocatorToContainText } from '../gadgets/assertHelpers';

// Group all login-related tests under a single describe block
test.describe('Login tests', () => {
  // The `loginPage` object is provided by our fixtures so we don't need to construct it.
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('Test 1: Login with valid credentials', async ({ loginPage, page }) => {
    await loginPage.login('tomsmith', 'SuperSecretPassword!'); // 'await' pauses the test until an action resolves
    await expectLocatorToContainText(loginPage.flashLocator(), 'You logged into a secure area!');
    await expect(page).toHaveURL('https://the-internet.herokuapp.com/secure');
  });
  
  test('Test 2: Invalid username', async ({ loginPage, page }) => {
    await loginPage.login('tomsmith1', 'SuperSecretPassword!');
    await expectLocatorToContainText(loginPage.flashLocator(), 'Your username is invalid!');
    await expect(page).toHaveURL('https://the-internet.herokuapp.com/login');
  });
 
  test('Test 3: Invalid password', async ({ loginPage, page }) => {
    await loginPage.login('tomsmith', 'SuperSecretPassword!!');
    await expectLocatorToContainText(loginPage.flashLocator(), 'Your password is invalid!');
    await expect(page).toHaveURL('https://the-internet.herokuapp.com/login');
  });
 
  test('Test 4: Missing username', async ({ loginPage, page }) => {
    await loginPage.login('', 'SuperSecretPassword!');
    await expectLocatorToContainText(loginPage.flashLocator(), 'Your username is isaalid!');
      await expect(page).toHaveURL('https://the-internet.herokuapp.com/login');
  });
  
  test('Test 5: Missing password', async ({ loginPage, page }) => {
    await loginPage.login('tomsmith', '');
    await expectLocatorToContainText(loginPage.flashLocator(), 'Your password is invalid!');
    await expect(page).toHaveURL('https://the-internet.herokuapp.com/login');
  });
});