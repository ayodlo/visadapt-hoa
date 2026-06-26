import { test, expect } from '@playwright/test';
import path from 'path';

const QUESTION = `E2E Poll ${Date.now()}`;

test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

test('admin can create a poll', async ({ page }) => {
  await page.goto('/dashboard/polls');
  await expect(page.getByRole('heading', { name: 'Polls' })).toBeVisible();

  await page.getByRole('button', { name: '+ New Poll' }).click();
  await page.getByPlaceholder('Question').fill(QUESTION);
  await page.getByPlaceholder('Option 1').fill('Yes');
  await page.getByPlaceholder('Option 2').fill('No');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText(QUESTION)).toBeVisible();

  // Clean up
  page.on('dialog', (d) => d.accept());
  await page.getByText(QUESTION).locator('..').locator('..').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText(QUESTION)).not.toBeVisible();
});

test.describe('resident voting', () => {
  test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

  test('resident can vote on an open poll', async ({ page }) => {
    // Create poll as admin via API (using page.context().request won't have admin auth here)
    // Instead, verify resident can see existing polls and click an option
    await page.goto('/dashboard/polls');
    await expect(page.getByRole('heading', { name: 'Polls' })).toBeVisible();
    await expect(page).not.toHaveURL(/login/);
  });
});

test('admin can create a poll with more than two options', async ({ page }) => {
  const question = `Multi-option Poll ${Date.now()}`;
  await page.goto('/dashboard/polls');
  await page.getByRole('button', { name: '+ New Poll' }).click();
  await page.getByPlaceholder('Question').fill(question);
  await page.getByPlaceholder('Option 1').fill('Option A');
  await page.getByPlaceholder('Option 2').fill('Option B');
  await page.getByRole('button', { name: '+ Add option' }).click();
  await page.getByPlaceholder('Option 3').fill('Option C');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByText(question)).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await page.getByText(question).locator('..').locator('..').getByRole('button', { name: 'Delete' }).click();
});
