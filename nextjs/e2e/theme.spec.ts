import { test, expect } from '@playwright/test';

const html = (page: import('@playwright/test').Page) => page.locator('html');
const toggle = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Toggle light or dark theme' });

test('light theme is the default', async ({ page }) => {
  await page.goto('/login');
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
});

test('toggle switches to dark and persists across reload', async ({ page }) => {
  await page.goto('/login');
  await toggle(page).click();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

  await page.reload();
  await expect(html(page)).toHaveAttribute('data-theme', 'dark');

  await toggle(page).click();
  await expect(html(page)).toHaveAttribute('data-theme', 'light');
});
