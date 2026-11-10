import { Page, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from '../config/test-credentials';

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_CREDENTIALS.admin.email);
  await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

export async function loginAsSuperAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_CREDENTIALS.superAdmin.email);
  await page.fill('input[type="password"]', TEST_CREDENTIALS.superAdmin.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

export async function loginAsDeveloper(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_CREDENTIALS.developer.email);
  await page.fill('input[type="password"]', TEST_CREDENTIALS.developer.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

export async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

