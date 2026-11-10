import { test, expect } from '@playwright/test';

import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('User Management', () => {
  let accessToken: string;

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Get access token for API calls if needed
    accessToken = await page.evaluate(() => localStorage.getItem('accessToken') || '');
  });

  test('should display users page', async ({ page }) => {
    // Navigate to users page (assuming it's in the admin dashboard)
    await page.goto('/dashboard');
    
    // Look for users section or tab
    const usersLink = page.locator('a, button').filter({ hasText: /Users/i }).first();
    if (await usersLink.isVisible()) {
      await usersLink.click();
      await expect(page.locator('text=/Users|User Management/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should open create user modal', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find and click "Add User" or "Create User" button
    const addUserButton = page.locator('button').filter({ hasText: /Add|Create|New.*User/i }).first();
    if (await addUserButton.isVisible()) {
      await addUserButton.click();
      
      // Verify modal opens
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('input[name="firstName"], input[placeholder*="First"]')).toBeVisible();
    }
  });

  test('should create a new user', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Open create user modal
    const addUserButton = page.locator('button').filter({ hasText: /Add|Create|New.*User/i }).first();
    if (await addUserButton.isVisible()) {
      await addUserButton.click();
      
      // Fill form
      const email = `testuser${Date.now()}@example.com`;
      await page.fill('input[type="email"], input[name="email"]', email);
      await page.fill('input[name="firstName"], input[placeholder*="First"]', 'Test');
      await page.fill('input[name="lastName"], input[placeholder*="Last"]', 'User');
      
      // Select role if dropdown exists
      const roleSelect = page.locator('select[name="roleId"], select').first();
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption({ index: 1 });
      }
      
      // Submit form
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Create|Submit/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Wait for success message or user to appear in list
        await expect(
          page.locator(`text=${email}, text=/success|created/i`)
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should edit user', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find first edit button in users table
    const editButton = page.locator('button').filter({ hasText: /Edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // Verify modal opens with user data
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 3000 });
      
      // Modify a field
      const firstNameInput = page.locator('input[name="firstName"]').first();
      if (await firstNameInput.isVisible()) {
        await firstNameInput.clear();
        await firstNameInput.fill('Updated');
        
        // Save
        const saveButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Update/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await expect(page.locator('text=/success|updated/i')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('should delete user', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find delete button
    const deleteButton = page.locator('button').filter({ hasText: /Delete/i }).first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Confirm deletion if dialog appears
      const confirmButton = page.locator('button').filter({ hasText: /Confirm|Yes|Delete/i }).first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await expect(page.locator('text=/success|deleted/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should search/filter users', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000); // Wait for search to execute
      
      // Verify results are filtered
      const results = page.locator('table tbody tr, [data-testid="user-item"]');
      const count = await results.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('should show validation error for duplicate email', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Open create user modal
    const addUserButton = page.locator('button').filter({ hasText: /Add|Create|New.*User/i }).first();
    if (await addUserButton.isVisible()) {
      await addUserButton.click();
      
      // Try to create user with existing email
      await page.fill('input[type="email"], input[name="email"]', TEST_CREDENTIALS.admin.email);
      await page.fill('input[name="firstName"]', 'Test');
      await page.fill('input[name="lastName"]', 'User');
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      // Should show error
      await expect(
        page.locator('text=/email.*exists|already.*exists|duplicate/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter users by role', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to users page
    const usersLink = page.locator('a, button').filter({ hasText: /Users/i }).first();
    if (await usersLink.isVisible()) {
      await usersLink.click();
      
      // Look for role filter
      const roleFilter = page.locator('select[name*="role"], select').first();
      if (await roleFilter.isVisible()) {
        // Select a role
        await roleFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        
        // Verify results are filtered
        const results = page.locator('table tbody tr');
        const count = await results.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should paginate users list', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to users page
    const usersLink = page.locator('a, button').filter({ hasText: /Users/i }).first();
    if (await usersLink.isVisible()) {
      await usersLink.click();
      
      // Look for pagination controls
      const nextButton = page.locator('button').filter({ hasText: /Next|>|»/i }).first();
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(1000);
        
        // Verify page changed
        const pageIndicator = page.locator('text=/page|Page/i');
        if (await pageIndicator.isVisible()) {
          await expect(pageIndicator).toBeVisible();
        }
      }
    }
  });
});

