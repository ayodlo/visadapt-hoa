import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

test('admin can view the users list', async ({ page }) => {
  await page.goto('/dashboard/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  // At minimum the three demo accounts should exist
  await expect(page.getByText('admin@communityhq.local')).toBeVisible();
  await expect(page.getByText('resident@communityhq.local')).toBeVisible();
});

test('users list shows roles', async ({ page }) => {
  await page.goto('/dashboard/users');
  await expect(page.getByText('ADMIN')).toBeVisible();
  await expect(page.getByText('RESIDENT')).toBeVisible();
});

test.describe('as resident', () => {
  test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

  test('resident can access the users page', async ({ page }) => {
    await page.goto('/dashboard/users');
    // Users page is currently accessible to all authenticated users
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });
});
