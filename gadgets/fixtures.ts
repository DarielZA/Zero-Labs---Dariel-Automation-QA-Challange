import { test as base, expect, TestInfo } from '@playwright/test';
import { LoginPage } from '../pages';
import * as path from 'path';
import * as fs from 'fs';
import { clearHighlights } from './assertHelpers';

// NOTE: Removed automatic HTML report opening from fixtures.
// The custom reporter now owns opening the report exactly once.

// Define our fixture types
type MyFixtures = {
  loginPage: LoginPage;
};

// Extend Playwright's test with a loginPage fixture
export const test = base.extend<MyFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
});

export { expect };

// Register a global afterEach hook to capture screenshots on failures
// Keep other fixture behavior but do not manually save screenshots here because Playwright
// is configured to save a single screenshot on failure (see `playwright.config.ts`).
test.afterEach(async ({ page }, testInfo: TestInfo) => {
  
  try {
    // Ensure a small delay for any DOM highlights to be painted
    await page.waitForTimeout(100);

    // Determine test type based on file name for organized results
    let testType = 'other';
    const fileName = path.basename(testInfo.file);
    if (fileName.endsWith('.spec.ts')) {
      testType = fileName;
    }

    // Organize test artifacts by moving files to the test type subfolder
    const subfolderName = path.basename(testInfo.outputDir);
    const newParent = path.join('test-results', testType);
    await fs.promises.mkdir(newParent, { recursive: true });
    const oldDir = testInfo.outputDir;
    const newDir = path.join(newParent, subfolderName);
    
    // Create the new directory
    await fs.promises.mkdir(newDir, { recursive: true });

    // Save screenshot to a temp location first
    const tempPath = path.join(newDir, 'temp_screenshot.png');
    await page.screenshot({ path: tempPath, fullPage: true });

    // Attach with the final path
    const finalScreenshotPath = path.join(newDir, 'attachments', 'screenshot-' + Date.now() + '.png');
    await testInfo.attach('screenshot', { path: finalScreenshotPath, contentType: 'image/png' });

    // Move all files from oldDir to newDir
    try {
      const files = fs.readdirSync(oldDir);
      for (const file of files) {
        const src = path.join(oldDir, file);
        const dest = path.join(newDir, file);
        fs.renameSync(src, dest);
      }
      // Remove old directory if empty
      if (fs.readdirSync(oldDir).length === 0) {
        fs.rmdirSync(oldDir);
      }
    } catch (err) {
      // Ignore move errors
    }

    // Move the screenshot to the final location
    const attachmentsDir = path.join(newDir, 'attachments');
    await fs.promises.mkdir(attachmentsDir, { recursive: true });
    fs.renameSync(tempPath, finalScreenshotPath);

    // Log for convenience
    console.log(`Saved screenshot for test: ${finalScreenshotPath}`);
    console.log('Test run completed');
  } catch (err: any) {
    console.warn('Failed to save screenshot:', err?.message || err);
  } finally {
    // Remove highlights after screenshot to keep following tests clean
    try {
      await clearHighlights(page);
    } catch (err) {
      // best effort
    }
    // Close the browser context to ensure worker cleanup
    try {
      await page.context().close();
    } catch (err) {
      // best effort
    }
  }
});
