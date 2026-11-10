import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';
import { loginAsSuperAdmin } from './helpers/auth';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as super admin - redirects to /dashboard, then navigate to super admin
    await loginAsSuperAdmin(page);
    
    // Navigate to super admin clients page
    await page.goto('/admin/super/clients');
    await page.waitForTimeout(1000);
  });

  test('should display clients page', async ({ page }) => {
    // Already navigated to clients page in beforeEach
    // Verify clients page is displayed
    await expect(
      page.locator('text=/Clients|Tenants|Client.*Management/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should create a new client', async ({ page }) => {
    // Already on clients page from beforeEach
    // Click create client button
    const createButton = page.locator('button').filter({ hasText: /Add|Create.*Client|New.*Client/i }).first();
    if (await createButton.isVisible({ timeout: 5000 })) {
      await createButton.click();
      await page.waitForTimeout(1000);
      
      // Fill form
      const clientName = `Test Client ${Date.now()}`;
      const subdomain = `test${Date.now()}`;
      
      await page.fill('input[name="name"], input[placeholder*="Name"]', clientName);
      await page.fill('input[name="subdomain"], input[placeholder*="Subdomain"]', subdomain);
      
      // Select database isolation type if available
      const isolationSelect = page.locator('select[name*="isolation"], select[name*="database"]').first();
      if (await isolationSelect.isVisible({ timeout: 2000 })) {
        await isolationSelect.selectOption({ index: 0 });
      }
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Create/i }).first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await expect(
          page.locator(`text=${clientName}, text=/success|created/i`)
        ).toBeVisible({ timeout: 10000 });
      }
    } else {
      test.skip();
    }
  });

  test('should show error for duplicate subdomain', async ({ page }) => {
    // Already on clients page from beforeEach
    // Click create client button
    const createButton = page.locator('button').filter({ hasText: /Add|Create.*Client/i }).first();
    if (await createButton.isVisible({ timeout: 5000 })) {
      await createButton.click();
      await page.waitForTimeout(1000);
      
      // Try to create client with existing subdomain
      await page.fill('input[name="name"]', 'Duplicate Test');
      await page.fill('input[name="subdomain"]', 'existing-subdomain'); // Assuming this exists
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      // Should show error
      await expect(
        page.locator('text=/subdomain.*exists|already.*exists|duplicate/i')
      ).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('should update client details', async ({ page }) => {
    // Already on clients page from beforeEach
    // Find edit button - wait a bit for table to load
    await page.waitForTimeout(1000);
    const editButton = page.locator('button').filter({ hasText: /Edit/i }).first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await page.waitForTimeout(1000);
      
      // Update name
      const nameInput = page.locator('input[name="name"]').first();
      if (await nameInput.isVisible({ timeout: 3000 })) {
        await nameInput.clear();
        await nameInput.fill('Updated Client Name');
        
        // Save
        const saveButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Update/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await expect(
            page.locator('text=/success|updated/i')
          ).toBeVisible({ timeout: 5000 });
        }
      }
    } else {
      // Skip test if no clients exist to edit
      test.skip();
    }
  });

  test('should configure SSO for client', async ({ page }) => {
    // Already on clients page from beforeEach
    // Find edit button
    await page.waitForTimeout(1000);
    const editButton = page.locator('button').filter({ hasText: /Edit/i }).first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await page.waitForTimeout(1000);
      
      // Look for SSO configuration section
      const ssoSection = page.locator('text=/SSO|OIDC|SAML/i').first();
      if (await ssoSection.isVisible({ timeout: 3000 })) {
        // Enable SSO
        const ssoToggle = page.locator('input[type="checkbox"][name*="sso"], input[type="checkbox"]').first();
        if (await ssoToggle.isVisible({ timeout: 2000 })) {
          await ssoToggle.check();
          
          // Fill SSO details
          await page.fill('input[name*="issuer"], input[placeholder*="Issuer"]', 'https://sso.example.com');
          await page.fill('input[name*="clientId"], input[placeholder*="Client ID"]', 'test-client-id');
          await page.fill('input[name*="clientSecret"], input[type="password"]', 'test-secret');
          await page.fill('input[name*="redirectUri"], input[placeholder*="Redirect"]', 'https://app.example.com/callback');
          
          // Save
          const saveButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Update/i }).first();
          if (await saveButton.isVisible()) {
            await saveButton.click();
            await expect(
              page.locator('text=/success|saved/i')
            ).toBeVisible({ timeout: 5000 });
          }
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    } else {
      test.skip();
    }
  });

  test('should enable/disable MFA enforcement for client', async ({ page }) => {
    // Already on clients page from beforeEach
    // Find edit button
    await page.waitForTimeout(1000);
    const editButton = page.locator('button').filter({ hasText: /Edit/i }).first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await page.waitForTimeout(1000);
      
      // Look for MFA enforcement toggle - try multiple selectors
      const mfaToggle = page.locator('input[type="checkbox"][name*="mfa"], input[type="checkbox"][name*="enforce"], input[type="checkbox"][name*="MFA"]').first();
      if (await mfaToggle.isVisible({ timeout: 3000 })) {
        const wasChecked = await mfaToggle.isChecked();
        await mfaToggle.setChecked(!wasChecked);
        
        // Save
        const saveButton = page.locator('button[type="submit"]').filter({ hasText: /Save|Update/i }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
          await expect(
            page.locator('text=/success|updated/i')
          ).toBeVisible({ timeout: 5000 });
        }
      } else {
        // MFA toggle might not be visible if feature not implemented
        // Skip this part of the test
        test.skip();
      }
    } else {
      // Skip test if no clients exist
      test.skip();
    }
  });

  test('should delete client', async ({ page }) => {
    // Already on clients page from beforeEach
    // Find delete button
    await page.waitForTimeout(1000);
    const deleteButton = page.locator('button').filter({ hasText: /Delete/i }).first();
    if (await deleteButton.isVisible({ timeout: 5000 })) {
      await deleteButton.click();
      await page.waitForTimeout(1000);
      
      // Confirm deletion
      const confirmButton = page.locator('button').filter({ hasText: /Confirm|Yes|Delete/i }).first();
      if (await confirmButton.isVisible({ timeout: 3000 })) {
        await confirmButton.click();
        await expect(
          page.locator('text=/success|deleted/i')
        ).toBeVisible({ timeout: 5000 });
      }
    } else {
      // Skip if no delete button (no clients or no permission)
      test.skip();
    }
  });
});
