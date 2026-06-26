import { test, expect } from '@playwright/test';
import path from 'path';

const TITLE = `E2E Maintenance ${Date.now()}`;

test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

test('resident can submit a maintenance request', async ({ page }) => {
  await page.goto('/dashboard/maintenance');
  await expect(page.getByRole('heading', { name: 'Maintenance Requests' })).toBeVisible();

  await page.getByRole('button', { name: '+ New Request' }).click();
  await page.getByPlaceholder('Title').fill(TITLE);
  await page.getByPlaceholder('Description').fill('The kitchen faucet is leaking.');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText(TITLE)).toBeVisible();
});

test.describe('as admin', () => {
  test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

  test('admin can update maintenance request status', async ({ page }) => {
    // Create a request via API first
    const resp = await page.context().request.post('/api/maintenance', {
      data: { title: TITLE, description: 'Status update test', priority: 'HIGH' },
    });
    expect(resp.ok()).toBeTruthy();
    const { id } = await resp.json();

    await page.goto('/dashboard/maintenance');
    const card = page.getByText(TITLE).locator('../../../..');
    await card.getByRole('combobox').selectOption('IN_PROGRESS');

    // Verify the status badge updates
    await expect(card.getByText('IN PROGRESS')).toBeVisible();

    // Clean up
    page.on('dialog', (d) => d.accept());
    await page.context().request.delete(`/api/maintenance/${id}`);
  });
});
