import { test, expect } from '@playwright/test';

// Smoke tests — verify the app renders and core navigation works.
// Uses data-testid only. Does NOT test dynamic data (requires live DB).

test.describe('App shell', () => {
  test('loads and shows sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-admin"]')).toBeVisible();
  });

  test('dashboard page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="page-dashboard"]')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('navigate to admin page', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="nav-admin"]');
    await expect(page.locator('[data-testid="page-admin"]')).toBeVisible();
  });

  test('navigate back to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="nav-admin"]');
    await page.click('[data-testid="nav-dashboard"]');
    await expect(page.locator('[data-testid="page-dashboard"]')).toBeVisible();
  });
});
