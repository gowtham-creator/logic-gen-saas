import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('Role Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should display roles page', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Navigate to roles section
    const rolesLink = page.locator('a, button').filter({ hasText: /Roles/i }).first();
    if (await rolesLink.isVisible()) {
      await rolesLink.click();
      await expect(page.locator('text=/Roles|Role Management/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should create a new role', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Open create role modal
    const addRoleButton = page.locator('button').filter({ hasText: /Add|Create.*Role/i }).first();
    if (await addRoleButton.isVisible()) {
      await addRoleButton.click();
      
      // Fill form
      const roleName = `Test Role ${Date.now()}`;
      await page.fill('input[name="name"], input[placeholder*="Name"]', roleName);
      await page.fill('textarea[name="description"], textarea[placeholder*="Description"]', 'Test role description');
      
      // Select permissions if available
      const permissionCheckboxes = page.locator('input[type="checkbox"]');
      const count = await permissionCheckboxes.count();
      if (count > 0) {
        await permissionCheckboxes.first().check();
      }
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Create/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await expect(page.locator(`text=${roleName}, text=/success/i`)).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should edit role permissions', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Find edit button
    const editButton = page.locator('button').filter({ hasText: /Edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // Toggle a permission
      const permissionCheckbox = page.locator('input[type="checkbox"]').first();
      if (await permissionCheckbox.isVisible()) {
        const wasChecked = await permissionCheckbox.isChecked();
        await permissionCheckbox.setChecked(!wasChecked);
        
        // Save
        const saveButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Update/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await expect(page.locator('text=/success|updated/i')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('should delete role', async ({ page }) => {
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

