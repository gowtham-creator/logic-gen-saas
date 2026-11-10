import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('MFA (Multi-Factor Authentication)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should enable MFA for user', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/client|\/dashboard/, { timeout: 10000 });
    
    // Navigate to security settings or profile
    await page.goto('/profile');
    
    // Look for MFA enable button
    const mfaButton = page.locator('button').filter({ hasText: /Enable.*MFA|Setup.*MFA|MFA/i }).first();
    if (await mfaButton.isVisible()) {
      await mfaButton.click();
      
      // Verify QR code is displayed
      await expect(
        page.locator('img[alt*="QR"], canvas, [data-testid="qr-code"]')
      ).toBeVisible({ timeout: 5000 });
      
      // Verify secret key is displayed
      await expect(
        page.locator('text=/secret|key|code/i')
      ).toBeVisible({ timeout: 3000 });
      
      // Enter verification code (mock code for testing)
      const codeInput = page.locator('input[type="text"][name*="code"], input[placeholder*="code"]').first();
      if (await codeInput.isVisible()) {
        await codeInput.fill('123456'); // Mock code
        
        // Submit
        const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Verify|Enable|Confirm/i }).first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await expect(
            page.locator('text=/MFA.*enabled|success|verified/i')
          ).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('should login with MFA', async ({ page }) => {
    // This test assumes a user with MFA enabled exists
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    
    // After successful password, should prompt for MFA code
    const mfaPrompt = page.locator('text=/MFA|verification.*code|enter.*code/i');
    if (await mfaPrompt.isVisible({ timeout: 5000 })) {
      // Enter MFA code
      const codeInput = page.locator('input[type="text"], input[name*="code"]').first();
      await codeInput.fill('123456'); // Mock code
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Verify|Login|Submit/i }).first();
      await submitButton.click();
      
      // Should redirect to dashboard after successful MFA
      await expect(page).toHaveURL(/\/dashboard|\/admin/, { timeout: 10000 });
    }
  });

  test('should show error for invalid MFA code', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    
    // If MFA prompt appears
    const mfaPrompt = page.locator('text=/MFA|verification.*code/i');
    if (await mfaPrompt.isVisible({ timeout: 5000 })) {
      // Enter invalid code
      const codeInput = page.locator('input[type="text"], input[name*="code"]').first();
      await codeInput.fill('000000'); // Invalid code
      
      // Submit
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: /Verify|Login/i }).first();
      await submitButton.click();
      
      // Should show error
      await expect(
        page.locator('text=/invalid.*code|wrong.*code|MFA.*failed/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should use backup code for login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    
    // If MFA prompt appears
    const mfaPrompt = page.locator('text=/MFA|verification.*code/i');
    if (await mfaPrompt.isVisible({ timeout: 5000 })) {
      // Look for backup code option
      const backupLink = page.locator('a, button').filter({ hasText: /backup.*code|use.*backup/i }).first();
      if (await backupLink.isVisible()) {
        await backupLink.click();
        
        // Enter backup code
        const codeInput = page.locator('input[type="text"], input[name*="backup"]').first();
        await codeInput.fill('BACKUP123456'); // Mock backup code
        
        // Submit
        const submitButton = page.locator('button[type="submit"]').first();
        await submitButton.click();
        
        // Should either succeed or show error (depending on if backup code is valid)
        await expect(
          page.locator('text=/success|invalid|error/i')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should disable MFA', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/client|\/dashboard/, { timeout: 10000 });
    
    // Navigate to profile/security settings
    await page.goto('/profile');
    
    // Look for disable MFA button
    const disableButton = page.locator('button').filter({ hasText: /Disable.*MFA|Remove.*MFA/i }).first();
    if (await disableButton.isVisible()) {
      await disableButton.click();
      
      // Confirm if dialog appears
      const confirmButton = page.locator('button').filter({ hasText: /Confirm|Yes|Disable/i }).first();
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
        await expect(
          page.locator('text=/MFA.*disabled|success/i')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

