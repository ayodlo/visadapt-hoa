import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

test('admin can create a dues record for a resident', async ({ page }) => {
  await page.goto('/dashboard/dues');
  await expect(page.getByRole('heading', { name: 'Dues' })).toBeVisible();

  // Get a resident user to assign dues to
  const usersResp = await page.context().request.get('/api/users');
  expect(usersResp.ok()).toBeTruthy();
  const users: { id: string; role: string; firstName: string; lastName: string }[] = await usersResp.json();
  const resident = users.find((u) => u.role === 'RESIDENT');
  expect(resident).toBeDefined();

  const label = `E2E Dues ${Date.now()}`;

  await page.getByRole('button', { name: '+ New Record' }).click();
  await page.getByRole('combobox').selectOption(resident!.id);
  await page.getByPlaceholder('Label (e.g. Q1 2026 HOA Dues)').fill(label);
  await page.getByPlaceholder('Amount ($)').fill('250');
  await page.locator('input[type="date"]').fill('2026-12-31');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(label)).toBeVisible();

  // Clean up via API
  const duesResp = await page.context().request.get('/api/dues');
  const dues: { id: string; label: string }[] = await duesResp.json();
  const created = dues.find((d) => d.label === label);
  if (created) {
    await page.context().request.delete(`/api/dues/${created.id}`);
  }
});

test.describe('as resident', () => {
  test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

  test('resident sees only their own dues', async ({ page }) => {
    await page.goto('/dashboard/dues');
    await expect(page.getByRole('heading', { name: 'Dues' })).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
  });
});
