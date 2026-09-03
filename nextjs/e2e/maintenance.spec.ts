import { test, expect } from '@playwright/test';
import path from 'path';

const RESIDENT_TITLE = `E2E Maintenance Resident ${Date.now()}`;
const ADMIN_TITLE = `E2E Maintenance Admin ${Date.now()}`;

test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

test('resident can submit a maintenance request', async ({ page }) => {
  await page.goto('/dashboard/maintenance');
  await expect(page.getByRole('heading', { name: 'Maintenance Requests' })).toBeVisible();

  // Residents submit through the multi-step form; staff keep the quick-entry
  // form. Detailed step coverage lives in maintenance-form.spec.ts.
  await page.getByRole('button', { name: '+ New Request' }).click();
  await page.locator('#mr-category').selectOption('PLUMBING');
  await page.locator('#mr-location').selectOption('INTERIOR');
  await page.locator('#mr-title').fill(RESIDENT_TITLE);
  await page.locator('#mr-description').fill('The kitchen faucet is leaking.');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#mr-scope').selectOption('HOA_COMMON');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // Attachments
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // Review
  await page.getByRole('button', { name: 'Submit request' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Request submitted' })).toBeVisible({ timeout: 15000 });

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
