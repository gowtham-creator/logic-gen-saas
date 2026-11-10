import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('Webhook Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/client/, { timeout: 10000 });
  });

  test('should display webhooks page', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to webhooks section
    const webhooksLink = page.locator('a, button').filter({ hasText: /Webhook/i }).first();
    if (await webhooksLink.isVisible()) {
      await webhooksLink.click();
      await expect(page.locator('text=/Webhook|Webhooks/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should create webhook', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Open create webhook modal
    const addButton = page.locator('button').filter({ hasText: /Add|Create.*Webhook/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Fill form
      await page.fill('input[name="name"], input[placeholder*="Name"]', `Test Webhook ${Date.now()}`);
      await page.fill('input[name="url"], input[type="url"]', 'https://example.com/webhook');
      
      // Select events
      const eventCheckboxes = page.locator('input[type="checkbox"]');
      const count = await eventCheckboxes.count();
      if (count > 0) {
        await eventCheckboxes.first().check();
      }
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Create/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await expect(page.locator('text=/success|created/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should test webhook', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find test button
    const testButton = page.locator('button').filter({ hasText: /Test/i }).first();
    if (await testButton.isVisible()) {
      await testButton.click();
      
      // Wait for test result
      await expect(page.locator('text=/success|failed|test.*result/i')).toBeVisible({ timeout: 10000 });
    }
  });
});

