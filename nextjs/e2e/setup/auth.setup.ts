import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.join(__dirname, '../.auth');

setup.beforeAll(() => {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
});

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: path.join(AUTH_DIR, 'admin.json') });
});

setup('authenticate as resident', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Resident' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: path.join(AUTH_DIR, 'resident.json') });
});

setup('authenticate as board member', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Board Member' }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: path.join(AUTH_DIR, 'board.json') });
});
