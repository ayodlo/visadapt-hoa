import { test, expect } from '@playwright/test';
import path from 'path';

const TITLE = `E2E Event ${Date.now()}`;
const START = '2030-12-25T10:00';

test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

test('admin can create and delete an event', async ({ page }) => {
  await page.goto('/dashboard/events');
  await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();

  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByPlaceholder('Title').fill(TITLE);
  await page.getByPlaceholder('Location').fill('Community Center');
  await page.getByLabel('Start').fill(START);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(TITLE)).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await page.getByText(TITLE).locator('..').locator('..').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(TITLE)).not.toBeVisible();
});

test.describe('as resident', () => {
  test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

  test('resident can view events list', async ({ page }) => {
    await page.goto('/dashboard/events');
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
  });
});
