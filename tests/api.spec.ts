import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// ReqRes requires API key header on requests
const API_KEY_HEADER = { 'x-api-key': 'reqres-free-v1' };

// Removed afterAll HTML report opening. Custom reporter will open once.

test.describe('ReqRes API Tests', () => {
  test.afterEach(async ({ browser }, testInfo) => {
    
    // Create a simple HTML page showing test info
    const safeTitle = testInfo.title.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    const proj = testInfo.project?.name ?? 'project';
    const dir = path.join('test-results', `${safeTitle}-${proj}`);
    await fs.promises.mkdir(dir, { recursive: true });
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; margin: 0; }
          .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 600px; }
          h1 { color: #333; margin-top: 0; }
          .status { font-size: 24px; font-weight: bold; padding: 10px; border-radius: 4px; margin: 10px 0; text-align: center; }
          .passed { background: #4caf50; color: white; }
          .failed { background: #f44336; color: white; }
          .info { margin: 10px 0; padding: 10px; background: #e3f2fd; border-radius: 4px; }
          .label { font-weight: bold; color: #1976d2; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>API Test Result</h1>
          <div class="status ${testInfo.status || 'unknown'}">${(testInfo.status || 'unknown').toUpperCase()}</div>
          <div class="info"><span class="label">Test:</span> ${testInfo.title}</div>
          <div class="info"><span class="label">Duration:</span> ${testInfo.duration}ms</div>
          <div class="info"><span class="label">Project:</span> ${testInfo.project?.name || 'default'}</div>
        </div>
      </body>
      </html>
    `;
    
    // Create a headless context to render HTML and take screenshot
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(htmlContent);
    const screenshotPath = path.join(dir, 'api-test-result.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await context.close();
    
    // Attach screenshot to the report
    await testInfo.attach('screenshot', { 
      path: screenshotPath, 
      contentType: 'image/png' 
    });
    
    console.log(`Test run completed: ${testInfo.status}`);
  });

  test('Test 1: GET /api/users?page=2 - status + structure + content', async ({ request }) => {
    const endpoint = 'https://reqres.in/api/users?page=2';
    console.log(`[Test 1 Input] Endpoint: ${endpoint}`);
    console.log(`[Test 1 Input] Headers:`, API_KEY_HEADER);

    await test.step('Send GET request', async () => {
      const response = await request.get(endpoint, {
        headers: API_KEY_HEADER,
      });

      expect(response.status(), 'GET users should return 200').toBe(200);

      const body = await response.json();

      // Structure checks (what fields exist and types)
      expect(body).toHaveProperty('page', 2);
      expect(body).toHaveProperty('per_page');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('total_pages');
      expect(Array.isArray(body.data), '`data` should be an array').toBe(true);

      // Content checks (one item has expected fields)
      expect(body.data.length, 'data array should not be empty').toBeGreaterThan(0);

      const firstUser = body.data[0];
      expect(firstUser).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          email: expect.any(String),
          first_name: expect.any(String),
          last_name: expect.any(String),
          avatar: expect.any(String),
        })
      );
    });
  });

  test('Test 2: POST /api/users - create user (name & job)', async ({ request }) => {
    const payload = { name: 'morpheus', job: 'leader' };
    const endpoint = 'https://reqres.in/api/users';

    console.log(`[Test 2 Input] Endpoint: ${endpoint}`);
    console.log(`[Test 2 Input] Method: POST`);
    console.log(`[Test 2 Input] Payload:`, JSON.stringify(payload, null, 2));
    console.log(`[Test 2 Input] Headers:`, { ...API_KEY_HEADER, 'Content-Type': 'application/json' });

    await test.step('Send POST request', async () => {
      const response = await request.post(endpoint, {
        headers: {
          ...API_KEY_HEADER,
          'Content-Type': 'application/json',
        },
        data: payload,
      });

      expect(response.status(), 'POST users should return 201 Created').toBe(201);

      const body = await response.json();

      // Validate response contains what we sent + generated fields
      expect(body).toEqual(
        expect.objectContaining({
          name: payload.name,
          job: payload.job,
          id: expect.any(String),
          createdAt: expect.any(String),
        })
      );
    });
  });

  test('Test 3: DELETE /api/users/2 - status code 204 + empty body', async ({ request }) => {
    const endpoint = 'https://reqres.in/api/users/2';
    
    console.log(`[Test 3 Input] Endpoint: ${endpoint}`);
    console.log(`[Test 3 Input] Method: DELETE`);
    console.log(`[Test 3 Input] Headers:`, API_KEY_HEADER);

    await test.step('Send DELETE request', async () => {
      const response = await request.delete(endpoint, {
        headers: API_KEY_HEADER,
      });

      expect(response.status(), 'DELETE should return 204 No Content').toBe(205);

      // Usually 204 means no response body
      const text = await response.text();
      expect(text, '204 responses should have an empty body').toBe('');
    });
  });

});
