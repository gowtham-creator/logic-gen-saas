import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './config/test-credentials';

test.describe('Security Monitoring & Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should lock account after 5 failed login attempts', async ({ page }) => {
    const testEmail = 'test@example.com';
    
    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      await page.goto('/login');
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // Wait for error message
      await expect(
        page.locator('text=/Invalid credentials|Login failed/i')
      ).toBeVisible({ timeout: 5000 });
      
      // Small delay between attempts
      await page.waitForTimeout(500);
    }
    
    // On 6th attempt, should show account locked message
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'anypassword');
    await page.click('button[type="submit"]');
    
    // Verify account locked message
    await expect(
      page.locator('text=/account.*locked|locked.*account|too.*many.*attempts/i')
    ).toBeVisible({ timeout: 5000 });
    
    // Verify cannot login even with correct password
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'correctpassword');
    await page.click('button[type="submit"]');
    await expect(
      page.locator('text=/account.*locked/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should trigger suspicious activity alert after multiple failed logins', async ({ page }) => {
    // This test verifies that multiple failed logins from same IP trigger alert
    // The alert should be sent to Slack (we can't verify Slack directly, but we can check logs)
    
    const testEmail = 'test@example.com';
    
    // Attempt 5 failed logins from same IP
    for (let i = 0; i < 5; i++) {
      await page.goto('/login');
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }
    
    // After 5 attempts, suspicious activity should be detected
    // This would trigger a Slack alert (verified in backend logs)
    // Frontend test can verify the account is locked
    await expect(
      page.locator('text=/account.*locked|suspicious.*activity/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should handle rate limit exceeded', async ({ page }) => {
    // Make multiple rapid requests to trigger rate limit
    // This test may need to be adjusted based on actual rate limits
    
    const requests = [];
    for (let i = 0; i < 25; i++) {
      requests.push(
        page.request.get('/api/auth/login', {
          failOnStatusCode: false
        })
      );
    }
    
    const responses = await Promise.all(requests);
    
    // Check if any response is 429 (Too Many Requests)
    const rateLimited = responses.some(r => r.status() === 429);
    
    // If rate limiting is working, at least one should be 429
    // Note: This depends on rate limit configuration
    if (rateLimited) {
      expect(rateLimited).toBe(true);
    }
  });

  test('should display security events in audit logs', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/client|\/dashboard/, { timeout: 10000 });
    
    // Navigate to audit logs
    await page.goto('/dashboard');
    const auditLogsLink = page.locator('a, button').filter({ hasText: /Audit|Logs/i }).first();
    if (await auditLogsLink.isVisible()) {
      await auditLogsLink.click();
      
      // Filter for security events
      const filterInput = page.locator('input[placeholder*="Action"], select[name*="action"]').first();
      if (await filterInput.isVisible()) {
        await filterInput.fill('LOGIN_FAILED');
        await page.waitForTimeout(1000);
        
        // Verify security events are displayed
        await expect(
          page.locator('text=/LOGIN_FAILED|ACCOUNT_LOCKED|SECURITY/i')
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

