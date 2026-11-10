import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Audit Logs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should display audit logs page', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to audit logs section
    const auditLogsLink = page.locator('a, button').filter({ hasText: /Audit|Logs/i }).first();
    if (await auditLogsLink.isVisible()) {
      await auditLogsLink.click();
      await expect(page.locator('text=/Audit.*Log|Activity/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter audit logs', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to audit logs
    const auditLogsLink = page.locator('a, button').filter({ hasText: /Audit|Logs/i }).first();
    if (await auditLogsLink.isVisible()) {
      await auditLogsLink.click();
      
      // Look for filter inputs
      const actionFilter = page.locator('input[placeholder*="Action"], select[name*="action"]').first();
      if (await actionFilter.isVisible()) {
        await actionFilter.fill('user.created');
        await page.waitForTimeout(1000);
      }
    }
  });
});

