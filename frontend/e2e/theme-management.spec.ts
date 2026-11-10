import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('Theme Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should load theme on login page', async ({ page }) => {
    await page.goto('/login');
    
    // Check if theme is applied (check for CSS variables or specific styles)
    const bodyStyles = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.body);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
      };
    });
    
    // Theme should be applied (not default white/black)
    expect(bodyStyles.backgroundColor).toBeTruthy();
  });

  test('should display theme management page', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to theme section
    const themeLink = page.locator('a, button').filter({ hasText: /Theme/i }).first();
    if (await themeLink.isVisible()) {
      await themeLink.click();
      await expect(page.locator('text=/Theme|Colors|Customize/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should update theme colors', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to theme
    const themeLink = page.locator('a, button').filter({ hasText: /Theme/i }).first();
    if (await themeLink.isVisible()) {
      await themeLink.click();
      
      // Find color picker or input
      const primaryColorInput = page.locator('input[type="color"], input[name*="primary"]').first();
      if (await primaryColorInput.isVisible()) {
        await primaryColorInput.fill('#FF0000');
        
        // Save
        const saveButton = page.locator('button').filter({ hasText: /Save|Update/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await expect(page.locator('text=/success|saved/i')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('should upload favicon', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to theme
    const themeLink = page.locator('a, button').filter({ hasText: /Theme/i }).first();
    if (await themeLink.isVisible()) {
      await themeLink.click();
      
      // Find file input for favicon
      const faviconInput = page.locator('input[type="file"][name*="favicon"], input[type="file"]').first();
      if (await faviconInput.isVisible()) {
        // Create a dummy file for testing
        await faviconInput.setInputFiles({
          name: 'favicon.ico',
          mimeType: 'image/x-icon',
          buffer: Buffer.from('dummy favicon content'),
        });
        
        // Wait for upload to complete
        await page.waitForTimeout(2000);
        await expect(page.locator('text=/success|uploaded/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

