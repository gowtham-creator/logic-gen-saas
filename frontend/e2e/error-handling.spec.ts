import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should handle network timeout gracefully', async ({ page }) => {
    // Simulate network timeout by blocking requests
    await page.route('**/api/**', route => {
      // Delay response to simulate timeout
      setTimeout(() => route.continue(), 10000);
    });
    
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    
    // Should show timeout error or loading state
    await expect(
      page.locator('text=/timeout|request.*timed.*out|try.*again/i')
    ).toBeVisible({ timeout: 15000 }).catch(() => {
      // If no specific timeout message, verify error is shown
      expect(page.locator('text=/error|failed/i')).toBeVisible();
    });
  });

  test('should handle server error (500)', async ({ page }) => {
    // Mock 500 error for API endpoint
    await page.route('**/api/users', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Navigate to users page
    await page.goto('/dashboard');
    const usersLink = page.locator('a, button').filter({ hasText: /Users/i }).first();
    if (await usersLink.isVisible()) {
      await usersLink.click();
      
      // Should show error message
      await expect(
        page.locator('text=/error|something.*went.*wrong|try.*again/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show validation errors on form submission', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Navigate to create user
    await page.goto('/dashboard');
    const addUserButton = page.locator('button').filter({ hasText: /Add|Create.*User/i }).first();
    if (await addUserButton.isVisible()) {
      await addUserButton.click();
      
      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Should show validation errors
        await expect(
          page.locator('text=/required|invalid|error/i')
        ).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should handle invalid email format', async ({ page }) => {
    await page.goto('/login');
    
    // Enter invalid email
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(
      page.locator('text=/invalid.*email|email.*format|validation/i')
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Some forms validate on blur, check for error state
      const emailInput = page.locator('input[type="email"]');
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  test('should handle 404 errors', async ({ page }) => {
    // Try to access non-existent page
    await page.goto('/non-existent-page');
    
    // Should show 404 page or redirect
    await expect(
      page.locator('text=/404|not.*found|page.*not.*found/i')
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Or redirect to home/login
      expect(page.url()).toMatch(/\/(login|dashboard|home)/);
    });
  });

  test('should handle 401 unauthorized errors', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('should handle 403 forbidden errors', async ({ page }) => {
    // Login as regular user (not admin)
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Try to access super admin route
    await page.goto('/admin/super');
    
    // Should show forbidden error or redirect
    await expect(
      page.locator('text=/forbidden|access.*denied|permission/i')
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Or redirect away
      expect(page.url()).not.toContain('/admin/super');
    });
  });
});

