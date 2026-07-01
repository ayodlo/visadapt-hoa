import { test, expect } from '@playwright/test';
import path from 'path';

const RESIDENT_TITLE = `E2E Maintenance Resident ${Date.now()}`;
const ADMIN_TITLE = `E2E Maintenance Admin ${Date.now()}`;

test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

test('resident can submit a maintenance request', async ({ page }) => {
  await page.goto('/dashboard/maintenance');
  await expect(page.getByRole('heading', { name: 'Maintenance Requests' })).toBeVisible();

  await page.getByRole('button', { name: '+ New Request' }).click();
  await page.getByPlaceholder('Title').fill(RESIDENT_TITLE);
  await page.getByPlaceholder('Description').fill('The kitchen faucet is leaking.');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText(RESIDENT_TITLE)).toBeVisible();

  // Clean up via API
  const resp = await page.context().request.get('/api/maintenance');
  const all: { id: string; title: string }[] = await resp.json();
  const created = all.find((r) => r.title === RESIDENT_TITLE);
  if (created) await page.context().request.delete(`/api/maintenance/${created.id}`);
});

test.describe('as admin', () => {
  test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

  test('admin can update maintenance request status', async ({ page }) => {
    const resp = await page.context().request.post('/api/maintenance', {
      data: { title: ADMIN_TITLE, description: 'Status update test', priority: 'HIGH' },
    });
    expect(resp.ok()).toBeTruthy();
    const { id } = await resp.json();

    await page.goto('/dashboard/maintenance');
    const card = page.locator('div.bg-white.border').filter({ hasText: ADMIN_TITLE });
    await card.getByRole('combobox').selectOption('IN_PROGRESS');

    await expect(card.locator('span', { hasText: 'IN PROGRESS' })).toBeVisible();

    await page.context().request.delete(`/api/maintenance/${id}`);
  });
});
