import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

test('admin can view the users list', async ({ page }) => {
  await page.goto('/dashboard/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(page.getByText('admin@communityhq.local')).toBeVisible();
  await expect(page.getByText('resident@communityhq.local')).toBeVisible();
});

test('users list shows role selects for each user', async ({ page }) => {
  await page.goto('/dashboard/users');
  // The admin user's row should have a combobox with value ADMIN
  const adminRow = page.locator('tr').filter({ hasText: 'admin@communityhq.local' });
  await expect(adminRow.getByRole('combobox')).toHaveValue('ADMIN');
  // The resident user's row should have RESIDENT
  const residentRow = page.locator('tr').filter({ hasText: 'resident@communityhq.local' });
  await expect(residentRow.getByRole('combobox')).toHaveValue('RESIDENT');
});

test.describe('as resident', () => {
  test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

  test('resident can access the users page', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });
});
