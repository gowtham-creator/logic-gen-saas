import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('Developer Tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1, h2')).toContainText(/Login|Sign in/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should login as developer', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.developer.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.developer.password);
    await page.click('button[type="submit"]');
    
    // Should redirect to developer dashboard
    await expect(page).toHaveURL(/\/developer\/dashboard/, { timeout: 10000 });
    
    // Verify developer flag is set
    const isDeveloper = await page.evaluate(() => localStorage.getItem('isDeveloper'));
    expect(isDeveloper).toBe('true');
  });

  test('should display developer dashboard', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.developer.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.developer.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/developer\/dashboard/, { timeout: 10000 });
    
    // Check for dashboard elements
    await expect(page.locator('text=/Developer|Dashboard|Tenants|Stats/i')).toBeVisible();
  });

  test('should display system statistics', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.developer.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.developer.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/developer\/dashboard/, { timeout: 10000 });
    
    // Check for stats cards
    await expect(page.locator('text=/Tenants|Users|Audit Logs/i')).toBeVisible({ timeout: 5000 });
  });

  test('should display tenants list', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.developer.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.developer.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/developer\/dashboard/, { timeout: 10000 });
    
    // Navigate to tenants tab
    const tenantsTab = page.locator('button, a').filter({ hasText: /Tenants|All Tenants/i }).first();
    if (await tenantsTab.isVisible()) {
      await tenantsTab.click();
      
      // Check for tenants table
      await expect(page.locator('table, [data-testid="tenants-table"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should view tenant details', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.developer.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.developer.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/developer\/dashboard/, { timeout: 10000 });
    
    // Navigate to tenants tab
    const tenantsTab = page.locator('button, a').filter({ hasText: /Tenants/i }).first();
    if (await tenantsTab.isVisible()) {
      await tenantsTab.click();
      
      // Click view details button
      const viewButton = page.locator('button, a').filter({ hasText: /View|Details/i }).first();
      if (await viewButton.isVisible()) {
        await viewButton.click();
        
        // Check for details modal
        await expect(page.locator('text=/Tenant Details|ID|Subdomain/i')).toBeVisible({ timeout: 3000 });
      }
    }
  });
});

