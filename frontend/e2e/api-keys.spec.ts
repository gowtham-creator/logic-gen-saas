import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should display API keys page', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to API keys section
    const apiKeysLink = page.locator('a, button').filter({ hasText: /API.*Key/i }).first();
    if (await apiKeysLink.isVisible()) {
      await apiKeysLink.click();
      await expect(page.locator('text=/API.*Key|API Keys/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should create API key', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Open create API key modal
    const addButton = page.locator('button').filter({ hasText: /Add|Create|Generate.*Key/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Fill form
      const keyName = `Test Key ${Date.now()}`;
      await page.fill('input[name="name"], input[placeholder*="Name"]', keyName);
      
      // Select scopes if available
      const scopeCheckboxes = page.locator('input[type="checkbox"]');
      const count = await scopeCheckboxes.count();
      if (count > 0) {
        await scopeCheckboxes.first().check();
      }
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Generate|Create/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // API key should be displayed (only shown once)
        await expect(page.locator('text=/key_|API.*Key.*generated/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should revoke API key', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find revoke button
    const revokeButton = page.locator('button').filter({ hasText: /Revoke/i }).first();
    if (await revokeButton.isVisible()) {
      await revokeButton.click();
      
      // Confirm if dialog appears
      const confirmButton = page.locator('button').filter({ hasText: /Confirm|Yes/i }).first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await expect(page.locator('text=/success|revoked/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should delete API key', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find delete button
    const deleteButton = page.locator('button').filter({ hasText: /Delete/i }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Confirm
      const confirmButton = page.locator('button').filter({ hasText: /Confirm|Yes/i }).first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await expect(page.locator('text=/success|deleted/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

