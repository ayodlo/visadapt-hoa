import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

test('admin can view the users list', async ({ page }) => {
  await page.goto('/dashboard/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(page.getByText('admin@portalhoa.local')).toBeVisible();
  await expect(page.getByText('resident@portalhoa.local')).toBeVisible();
});

test('users list shows role selects for each user', async ({ page }) => {
  await page.goto('/dashboard/users');
  // The admin user's row should have a combobox with value ADMIN
  const adminRow = page.locator('tr').filter({ hasText: 'admin@portalhoa.local' });
  await expect(adminRow.getByRole('combobox')).toHaveValue('ADMIN');
  // The resident user's row should have RESIDENT
  const residentRow = page.locator('tr').filter({ hasText: 'resident@portalhoa.local' });
  await expect(residentRow.getByRole('combobox')).toHaveValue('RESIDENT');
});

test.describe('as board member', () => {
  test.use({ storageState: path.join(__dirname, '.auth/board.json') });

  test('board member sees a read-only roster (no role selects, no delete)', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.getByText('resident@portalhoa.local')).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  });
});

test.describe('as resident', () => {
  test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

  test('resident is redirected away from the users page', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page).toHaveURL(/\/resident\/dashboard/);
  });

  test('resident cannot fetch the users roster API', async ({ page }) => {
    const res = await page.request.get('/api/users');
    expect(res.status()).toBe(403);
  });
});
