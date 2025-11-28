// Import Playwright's 'Page' type for proper typing of page objects
import { Page } from '@playwright/test';
// Node helpers used to create screenshot folders and generate paths
import * as fs from 'fs';
import * as path from 'path';

// Export a default BasePage class that other Page Objects will extend
export default class BasePage {
  // Hold the Playwright 'Page' instance so methods can use it
  protected page: Page;

  // Constructor receives the Playwright 'page' and stores it
  constructor(page: Page) {
    // Assign the incoming page to the instance variable for reuse
    this.page = page;
  }

  // Navigate the Playwright page to a provided URL
  async goto(url: string) {
    // Use Playwright's API to open the given URL
    await this.page.goto(url);
  }

  // Take a screenshot and save it under `test-results/screenshots`.
  // Returns the path to the saved file.
  async saveScreenshot(name?: string): Promise<string> {
    // build a timestamped filename so screenshots don't overwrite
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${name ?? 'screenshot'}-${timestamp}.png`;
    const dir = path.join('test-results', 'screenshots');
    const fullPath = path.join(dir, fileName);

    // ensure the directory exists
    await fs.promises.mkdir(dir, { recursive: true });

    // save the screenshot (full page) and return the path
    await this.page.screenshot({ path: fullPath, fullPage: true });
    return fullPath;
  }
}
