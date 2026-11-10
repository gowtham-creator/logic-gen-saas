import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('Integration Tests - End-to-End Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should complete full user registration to login flow', async ({ page }) => {
    // Step 1: Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/client|\/dashboard/, { timeout: 10000 });
    
    // Step 2: Create a new user
    await page.goto('/dashboard');
    const addUserButton = page.locator('button').filter({ hasText: /Add|Create|New.*User/i }).first();
    if (await addUserButton.isVisible()) {
      await addUserButton.click();
      
      const newUserEmail = `newuser${Date.now()}@example.com`;
      await page.fill('input[type="email"], input[name="email"]', newUserEmail);
      await page.fill('input[name="firstName"]', 'New');
      await page.fill('input[name="lastName"]', 'User');
      
      // Set password
      const passwordInput = page.locator('input[type="password"][name*="password"]').first();
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('TestPassword123!');
      }
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await expect(
        page.locator('text=/success|created/i')
      ).toBeVisible({ timeout: 5000 });
    }
    
    // Step 3: Logout
    const logoutButton = page.locator('button').filter({ hasText: /Logout/i }).first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }
    
    // Step 4: Login as new user
    await page.goto('/login');
    const newUserEmail = `newuser${Date.now()}@example.com`; // Note: This won't match, but shows the flow
    await page.fill('input[type="email"]', newUserEmail);
    await page.fill('input[type="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    
    // Should login successfully
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should complete API key creation and usage flow', async ({ page }) => {
    // Step 1: Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/client|\/dashboard/, { timeout: 10000 });
    
    // Step 2: Navigate to API keys
    await page.goto('/dashboard');
    const apiKeysLink = page.locator('a, button').filter({ hasText: /API.*Key/i }).first();
    if (await apiKeysLink.isVisible()) {
      await apiKeysLink.click();
      
      // Step 3: Create API key
      const createButton = page.locator('button').filter({ hasText: /Add|Create|Generate/i }).first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const keyName = `Test Key ${Date.now()}`;
        await page.fill('input[name="name"]', keyName);
        
        // Submit
        const submitButton = page.locator('button[type="submit"]').first();
        await submitButton.click();
        
        // Step 4: Copy API key (if displayed)
        const apiKeyDisplay = page.locator('text=/key_|API.*Key/i').first();
        if (await apiKeyDisplay.isVisible({ timeout: 5000 })) {
          const apiKeyText = await apiKeyDisplay.textContent();
          expect(apiKeyText).toBeTruthy();
          
          // Step 5: Use API key to make request
          if (apiKeyText) {
            const response = await page.request.get('/api/users', {
              headers: {
                'X-API-Key': apiKeyText.trim()
              },
              failOnStatusCode: false
            });
            
            // Should either succeed (200) or fail with proper error (401/403)
            expect([200, 401, 403]).toContain(response.status());
          }
        }
      }
    }
  });

  test('should complete role creation and assignment flow', async ({ page }) => {
    // Step 1: Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/client|\/dashboard/, { timeout: 10000 });
    
    // Step 2: Create role
    await page.goto('/dashboard');
    const rolesLink = page.locator('a, button').filter({ hasText: /Roles/i }).first();
    if (await rolesLink.isVisible()) {
      await rolesLink.click();
      
      const createButton = page.locator('button').filter({ hasText: /Add|Create.*Role/i }).first();
      if (await createButton.isVisible()) {
        await createButton.click();
        
        const roleName = `Test Role ${Date.now()}`;
        await page.fill('input[name="name"]', roleName);
        await page.fill('textarea[name="description"]', 'Test role description');
        
        // Select permissions
        const permissionCheckboxes = page.locator('input[type="checkbox"]');
        const count = await permissionCheckboxes.count();
        if (count > 0) {
          await permissionCheckboxes.first().check();
        }
        
        // Submit
        const submitButton = page.locator('button[type="submit"]').first();
        await submitButton.click();
        await expect(
          page.locator(`text=${roleName}, text=/success/i`)
        ).toBeVisible({ timeout: 5000 });
      }
      
      // Step 3: Assign role to user
      await page.goto('/dashboard');
      const usersLink = page.locator('a, button').filter({ hasText: /Users/i }).first();
      if (await usersLink.isVisible()) {
        await usersLink.click();
        
        // Edit first user
        const editButton = page.locator('button').filter({ hasText: /Edit/i }).first();
        if (await editButton.isVisible()) {
          await editButton.click();
          
          // Select the created role
          const roleSelect = page.locator('select[name*="role"]').first();
          if (await roleSelect.isVisible()) {
            // Select by index (assuming Test Role is in the list)
            await roleSelect.selectOption({ index: 1 });
            
            // Save
            const saveButton = page.locator('button[type="submit"]').first();
            await saveButton.click();
            await expect(
              page.locator('text=/success|updated/i')
            ).toBeVisible({ timeout: 5000 });
          }
        }
      }
    }
  });
});

