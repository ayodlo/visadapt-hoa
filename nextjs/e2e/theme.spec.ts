import { test, expect } from '@playwright/test';

const html = (page: import('@playwright/test').Page) => page.locator('html');
const toggle = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Toggle light or dark theme' });

test('dark theme is the default', async ({ page }) => {
  await page.goto('/login');
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
});

test('toggle switches to light and persists across reload', async ({ page }) => {
  await page.goto('/login');
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');

  await page.reload();
  await expect(html(page)).toHaveAttribute('data-theme', 'light');

  await toggle(page).click();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
});
