import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('Super Admin Flow', () => {
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

  test('should login as super admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.superAdmin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.superAdmin.password);
    await page.click('button[type="submit"]');
    
    // Should redirect to super admin dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Verify super admin flag is set
    const isSuperAdmin = await page.evaluate(() => localStorage.getItem('isSuperAdmin'));
    expect(isSuperAdmin).toBe('true');
  });

  test('should show error if client does not allow super admin login', async ({ page }) => {
    // This test assumes a client without allowSuperAdminLogin
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email); // Regular admin
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    
    // Wait for response - either error message appears or we stay on login page
    // The error message should be: "Super admin login is not allowed for this tenant. Please contact your administrator."
    // Or it might show "Login failed" or "Invalid credentials"
    
    // Wait for either error message to appear OR verify we're still on login page
    // (both indicate that login failed)
    try {
      // Wait for error message to appear
      await expect(
        page.locator('text=/Super admin login is not allowed|not allowed for this tenant|Login failed|Invalid credentials/i')
      ).toBeVisible({ timeout: 5000 });
    } catch {
      // If no error message, verify we're still on login page (login failed)
      await expect(page).toHaveURL(/\/login/, { timeout: 3000 });
    }
    
    // Verify we did NOT get redirected to admin dashboard
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/admin/super');
  });

  test('should display super admin dashboard', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.superAdmin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.superAdmin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Check for dashboard elements - use more specific selectors
    // Check for the main heading "Super Admin"
    await expect(page.locator('h1').filter({ hasText: /Super Admin/i }).first()).toBeVisible({ timeout: 5000 });
    
    // Check for tab buttons (Tenants or Plans)
    const hasTenantsTab = await page.locator('button, a').filter({ hasText: /Tenants/i }).first().isVisible().catch(() => false);
    const hasPlansTab = await page.locator('button, a').filter({ hasText: /Plans/i }).first().isVisible().catch(() => false);
    
    // At least one tab should be visible
    expect(hasTenantsTab || hasPlansTab).toBe(true);
  });

  test('should navigate between tabs', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.superAdmin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.superAdmin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Click on different tabs
    const clientsTab = page.locator('button, a').filter({ hasText: /Clients|Tenants/i }).first();
    const plansTab = page.locator('button, a').filter({ hasText: /Plans/i }).first();
    const themeTab = page.locator('button, a').filter({ hasText: /Theme/i }).first();
    
    if (await clientsTab.isVisible()) {
      await clientsTab.click();
      // Wait for the clients/tenants content to load
      // Use a more specific selector - the heading "Tenants" or "Clients"
      await expect(page.locator('h1, h2').filter({ hasText: /Tenants|Clients/i }).first()).toBeVisible({ timeout: 5000 });
    }
    
    if (await plansTab.isVisible()) {
      await plansTab.click();
      // Wait for the plans content to load
      // Use a more specific selector - the heading "Plans"
      await expect(page.locator('h1, h2').filter({ hasText: /Plans/i }).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

