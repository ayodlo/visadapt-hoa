import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.join(__dirname, '../.auth');
const PASSWORD = 'password123';

setup.beforeAll(() => {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
});

async function signIn(page: import('@playwright/test').Page, email: string, stateFile: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await page.context().storageState({ path: path.join(AUTH_DIR, stateFile) });
}

setup('authenticate as admin', async ({ page }) => {
  await signIn(page, 'admin@communityhq.local', 'admin.json');
});

setup('authenticate as resident', async ({ page }) => {
  await signIn(page, 'resident@communityhq.local', 'resident.json');
});

setup('authenticate as board member', async ({ page }) => {
  await signIn(page, 'board@communityhq.local', 'board.json');
});
