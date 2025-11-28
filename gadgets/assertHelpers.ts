import { Locator, Page, expect } from '@playwright/test';

const HIGHLIGHT_ATTR = 'data-pp-highlight';
const LABEL_ATTR = 'data-pp-hlabel';

// Add highlight to a locator: outline + optional label
export async function highlightLocator(locator: Locator, label?: string) {
  await locator.evaluate((el, labelText) => {
    // Attach an attribute to detect highlighted elements
    (el as HTMLElement).setAttribute('data-pp-highlight', 'true');
    // Add inline outline style so screenshot shows visually
    (el as HTMLElement).style.outline = '3px solid #ffdd00';
    (el as HTMLElement).style.position = 'relative';
    // Optionally add a label badge
    if (labelText) {
      const badge = document.createElement('div');
      badge.setAttribute('data-pp-hlabel', 'true');
      badge.textContent = labelText;
      badge.style.position = 'absolute';
      badge.style.top = '0';
      badge.style.right = '0';
      badge.style.background = 'rgba(255, 204, 0, 0.95)';
      badge.style.color = '#000';
      badge.style.padding = '2px 6px';
      badge.style.fontSize = '12px';
      badge.style.borderBottomLeftRadius = '4px';
      (el as HTMLElement).appendChild(badge);
    }
  }, label || 'assert');
}

// Remove highlights inserted by the helper
export async function clearHighlights(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('[data-pp-hlabel]').forEach(e => e.remove());
    document.querySelectorAll('[data-pp-highlight]').forEach(e => {
      (e as HTMLElement).style.outline = '';
      e.removeAttribute('data-pp-highlight');
    });
  });
}

// Shorthand helper to highlight then assert containText on locator
export async function expectLocatorToContainText(locator: Locator, text: string) {
  // Add highlight
  await highlightLocator(locator, 'assert');
  // Run Playwright expect and catch failures to update label
  try {
    await expect(locator).toContainText(text);
  } catch (err) {
    // Update the badge to show "Assert Failed" on failure
    await locator.evaluate((el) => {
      const badge = el.querySelector('[data-pp-hlabel]') as HTMLElement;
      if (badge) {
        badge.textContent = 'Assert Failed';
        badge.style.background = 'rgba(255, 0, 0, 0.95)';
        badge.style.color = '#fff';
      }
    });
    throw err; // Re-throw to fail the test
  }
}

// Another helper: expect visible
export async function expectLocatorVisible(locator: Locator) {
  await highlightLocator(locator, 'assert');
  try {
    await expect(locator).toBeVisible();
  } catch (err) {
    // Update the badge to show "Assert Failed" on failure
    await locator.evaluate((el) => {
      const badge = el.querySelector('[data-pp-hlabel]') as HTMLElement;
      if (badge) {
        badge.textContent = 'Assert Failed';
        badge.style.background = 'rgba(255, 0, 0, 0.95)';
        badge.style.color = '#fff';
      }
    });
    throw err; // Re-throw to fail the test
  }
}

export default {
  highlightLocator,
  clearHighlights,
  expectLocatorToContainText,
  expectLocatorVisible,
};
